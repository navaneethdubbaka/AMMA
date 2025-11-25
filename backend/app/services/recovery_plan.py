from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Dict, List, Optional


@dataclass(frozen=True)
class RecoveryDayPlan:
  day: int
  title: str
  description: str
  focus: str
  checklist: List[str]


PLAN_DEFINITIONS: Dict[int, RecoveryDayPlan] = {
  1: RecoveryDayPlan(
    day=1,
    title="Initial Assessment & Care",
    description="Reinforce immediate post-visit instructions and symptom expectations.",
    focus="Rest, hydration, pain baseline capture, medication reminders.",
    checklist=[
      "Review wound/incision care instructions",
      "Confirm medication schedule and first doses",
      "Explain when to escalate to physician",
    ],
  ),
  3: RecoveryDayPlan(
    day=3,
    title="Early Progress Check",
    description="Highlight early improvements or concerns to watch for.",
    focus="Inflammation control, breathing exercises, adherence to rest schedule.",
    checklist=[
      "Discuss pain trend vs day 1",
      "Remind about breathing/circulatory exercises",
      "Encourage symptom journaling",
    ],
  ),
  5: RecoveryDayPlan(
    day=5,
    title="Medication & Wound Review",
    description="Revisit medication technique and wound expectations.",
    focus="Medication adherence, wound observation, nutrition.",
    checklist=[
      "Demonstrate correct medication timing",
      "Describe expected wound appearance",
      "Promote high-protein meals and hydration",
    ],
  ),
  7: RecoveryDayPlan(
    day=7,
    title="First Week Milestone",
    description="Celebrate progress and outline gentle mobility goals.",
    focus="Light mobility, swelling reduction, mental health check-in.",
    checklist=[
      "Explain safe mobility exercises",
      "Call out red-flag symptoms",
      "Share coping strategies for anxiety or fatigue",
    ],
  ),
  10: RecoveryDayPlan(
    day=10,
    title="Pain Management & PT Intro",
    description="Transition patient towards guided therapy routines.",
    focus="Adjust pain regimen, introduce PT warmups, reinforce follow-up date.",
    checklist=[
      "Explain difference between soreness vs sharp pain",
      "Demonstrate first PT warmup",
      "Confirm upcoming clinical visit",
    ],
  ),
  14: RecoveryDayPlan(
    day=14,
    title="Two-Week Checkpoint",
    description="Assess mobility gains and encourage gradual independence.",
    focus="Activity pacing, sleep hygiene, continuing wound care.",
    checklist=[
      "Review mobility milestones completed",
      "Discuss sleep positioning",
      "Remind about scar management if applicable",
    ],
  ),
  17: RecoveryDayPlan(
    day=17,
    title="Mid-Recovery Reset",
    description="Address plateaus and reinforce motivation.",
    focus="Symptom tracking, nutrition upgrades, mental resilience.",
    checklist=[
      "Identify any healing plateaus",
      "Explain adjustments to meal plan",
      "Offer motivation techniques or support resources",
    ],
  ),
  21: RecoveryDayPlan(
    day=21,
    title="Three-Week Progress",
    description="Encourage confident movement and adherence.",
    focus="Advanced mobility cues, preventing overexertion.",
    checklist=[
      "Demonstrate progression for key exercises",
      "Warn against pushing through sharp pain",
      "Remind about hydration and electrolyte balance",
    ],
  ),
  24: RecoveryDayPlan(
    day=24,
    title="Advanced Exercises",
    description="Coach patient through more demanding routines.",
    focus="Strength building, stamina, monitoring delayed soreness.",
    checklist=[
      "Break down advanced exercise form",
      "Give pacing guidance",
      "Discuss managing delayed onset soreness",
    ],
  ),
  30: RecoveryDayPlan(
    day=30,
    title="Graduation & Long-Term Plan",
    description="Outline long-term maintenance and warning signs.",
    focus="Sustaining habits, scheduling follow-ups, transitioning to lifestyle care.",
    checklist=[
      "Summarize achievements",
      "Set expectations for next clinician visit",
      "Share long-term prevention tips",
    ],
  ),
}


def get_plan_for_day(day: int) -> Optional[Dict[str, object]]:
  plan = PLAN_DEFINITIONS.get(day)
  return asdict(plan) if plan else None


def get_prior_plans(day: int) -> List[Dict[str, object]]:
  prior_days = [d for d in sorted(PLAN_DEFINITIONS.keys()) if d < day]
  return [asdict(PLAN_DEFINITIONS[d]) for d in prior_days]

