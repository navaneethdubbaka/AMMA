import asyncio
import hashlib
import json
from typing import Any, Dict

import google.generativeai as genai


class LLMService:
  """Handles prompt construction and dispatching to Gemini."""

  def __init__(self, api_key: str, model_name: str) -> None:
    genai.configure(api_key=api_key)
    self._model = genai.GenerativeModel(model_name)

  async def build_prompt(self, context: Dict[str, Any]) -> str:
    """Return a deterministic prompt string for the provided patient context."""
    patient = context["patient"]
    doctor = context["doctor"]
    diagnoses = context.get("diagnoses", [])
    medications = context.get("medications", [])
    notes = context.get("notes") or "No supplemental notes provided."
    recovery_plan = context.get("recovery_plan")
    prior_recovery = context.get("prior_recovery_context", [])

    diagnoses_text = ", ".join(diagnoses) or "Not specified"
    medications_text = ", ".join(medications) or "No active medications listed"

    prompt = (
      f"You are creating a compassionate clinical explainer video.\n"
      f"Patient: {patient['first_name']} {patient['last_name']}\n"
      f"Doctor: Dr. {doctor['last_name']}\n"
      f"Diagnoses: {diagnoses_text}\n"
      f"Medications: {medications_text}\n"
      f"Additional Notes:\n{notes}\n"
      "Generate a concise script with:\n"
      "1. Friendly greeting\n"
      "2. Plain-language condition overview\n"
      "3. Treatment plan and expectations\n"
      "4. Key reminders and next steps\n"
      "Return JSON with keys intro, overview, treatment, reminders."
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
    """Call Gemini with the prepared prompt."""
    result = await asyncio.to_thread(self._model.generate_content, prompt)
    text = (result.text or "").strip()

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
    script_body: str,
    doctor_specialty: str,
  ) -> str:
    """Generate deterministic key for video reuse."""
    summary = f"{diagnosis_code}:{procedure_code}:{doctor_specialty}:{script_body}".lower()
    digest = hashlib.sha256(summary.encode("utf-8")).hexdigest()
    return digest

