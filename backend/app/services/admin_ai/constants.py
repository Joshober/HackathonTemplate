"""Shared constants for Admin AI Solver."""

CONFIRMABLE_INTENTS = frozenset(
    {
        "remove_team_member",
        "update_team_member_availability",
        "update_price",
        "update_prompt_config",
    }
)
