import asyncio
import hashlib
import json
from typing import Any, Dict

from openai import AsyncOpenAI


class LLMService:
  """Handles prompt construction and dispatching to OpenAI."""

  def __init__(self, api_key: str, model_name: str) -> None:
    self._client = AsyncOpenAI(api_key=api_key)
    self._model = model_name

  async def build_prompt(self, context: Dict[str, Any]) -> str:
    """Return a deterministic prompt string for the provided patient context."""
    patient = context["patient"]
    doctor = context["doctor"]
    diagnoses = context.get("diagnoses", [])
    medications = context.get("medications", [])
    notes = context.get("notes") or "No supplemental notes provided."
    recovery_plan = context.get("recovery_plan")
    prior_recovery = context.get("prior_recovery_context", [])

    patient_name = f"{patient.get('first_name', '').strip()} {patient.get('last_name', '').strip()}".strip()
    doctor_name = f"Dr. {doctor.get('last_name', '').strip() or doctor.get('first_name', '').strip()}".strip()
    diagnoses_text = ", ".join(diagnoses) or "Not specified"
    medications_text = ", ".join(medications) or "No active medications listed"

    storyboard = """
You are a medical video script writer crafting a 45-second animated explainer for patients. 
Output JSON with keys: intro, brain_intro, what_is, benign_vs_malignant, symptoms, diagnosis, closing, narrator_tone, visual_style.
Each of intro through closing must be an object like {"narration": "...", "visuals": "..."}.
Follow this scene plan:
1. Opening (0-5s): friendly cartoon hospital, narrator says “Today, let’s understand what a brain tumour is.”
2. Brain introduction (5-10s): glowing cartoon brain highlighting functions.
3. What is a brain tumour? (10-20s): soft visualization of cells growing.
4. Benign vs Malignant (20-27s): split screen characters, calm vs assertive.
5. Symptoms (27-35s): illustrate headaches, blurry vision, speech difficulty, balance issues.
6. Diagnosis (35-42s): MRI/CT scan animation with doctor explaining gently.
7. Closing (42-45s): hopeful hospital scene, emphasize early diagnosis & care plan.
Tone: compassionate, plain language, reassuring.
Visual style: gentle colors, smooth motion, friendly cartoon aesthetic, no frightening imagery.
Never mention JSON or technical instructions inside narration.
"""

    prompt = (
      f"{storyboard}\n"
      f"Patient: {patient_name or 'Patient'}\n"
      f"Doctor: {doctor_name or 'Doctor'}\n"
      f"Diagnoses: {diagnoses_text}\n"
      f"Medications: {medications_text}\n"
      f"Additional Notes:\n{notes}\n"
    )

    if recovery_plan:
      prompt += (
        f"\n\nToday's recovery milestone (Day {recovery_plan.get('day')}): {recovery_plan.get('title')}.\n"
        f"Focus: {recovery_plan.get('focus')}\n"
        f"Checklist items: {', '.join(recovery_plan.get('checklist', []))}\n"
        f"Milestone label: {context.get('recovery_milestone') or recovery_plan.get('title')}\n"
        "Ensure the script references today's objectives explicitly."
      )

    if prior_recovery:
      summaries = "; ".join(
        f"Day {item.get('day')}: {item.get('title')}" for item in prior_recovery
      )
      prompt += (
        "\n\nPrevious recovery context that must be referenced for continuity:\n"
        f"{summaries}\n"
        "Acknowledge prior progress and set expectations for the next check-in."
      )

    return prompt

  async def request_script(self, prompt: str) -> Dict[str, Any]:
    """Call OpenAI with the prepared prompt."""
    response = await self._client.chat.completions.create(
      model=self._model,
      messages=[
        {
          "role": "system",
          "content": "You are a medical video script writer. Generate clear, compassionate, patient-friendly explanations. Always return valid JSON."
        },
        {
          "role": "user",
          "content": prompt
        }
      ],
      response_format={"type": "json_object"},
      temperature=0.7
    )
    
    text = response.choices[0].message.content or ""
    text = text.strip()

    try:
      parsed = json.loads(text)
      if isinstance(parsed, dict):
        parsed.setdefault("content", text)
        return parsed
    except json.JSONDecodeError:
      pass

    return {"content": text}

  @staticmethod
  def compute_case_key(
    *,
    diagnosis_code: str,
    procedure_code: str,
    recovery_milestone: str | None = None,
    doctor_specialty: str | None = None,
  ) -> str:
    """Generate deterministic key for video reuse."""
    parts = [
      diagnosis_code or "unknown_diagnosis",
      procedure_code or "unknown_procedure",
      (recovery_milestone or "").strip() or "no_milestone",
      (doctor_specialty or "").strip() or "general",
    ]
    summary = ":".join(parts).lower()
    digest = hashlib.sha256(summary.encode("utf-8")).hexdigest()
    return digest

