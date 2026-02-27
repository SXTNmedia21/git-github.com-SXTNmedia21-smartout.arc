import os
import datetime
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext

# ============================================================================
# 1. Output Data Structures
# ============================================================================
class OnboardingIntelligence(BaseModel):
    """The JSON structure we want the AI to return at the end of the interview."""
    company_name: Optional[str] = Field(None, description="The name of the business")
    vibe: Optional[str] = Field(None, description="The concept or vibe")
    general_manager: Optional[str] = Field(None, description="Daglig leder")
    hr_manager: Optional[str] = Field(None, description="Personalansvarig")
    fire_safety_manager: Optional[str] = Field(None, description="Brannansvarig")
    current_season: Optional[str] = Field(None, description="Current operating season")
    departments: List[str] = Field(default_factory=list, description="List of departments")
    teams: List[str] = Field(default_factory=list, description="List of teams")
    locations: List[str] = Field(default_factory=list, description="List of physical locations")
    zones: List[str] = Field(default_factory=list, description="List of zones")
    assets_with_haccp: List[str] = Field(default_factory=list, description="Assets requiring HACCP or routines")


# ============================================================================
# 2. Pydantic AI Agent Setup
# ============================================================================
# The 'deps_type' is the path to the current interview's folder (as a string).
onboarding_agent = Agent(
    "openai:gpt-4o",  # or claude-3-5-sonnet depending on your LLM provider
    deps_type=str,    
    result_type=OnboardingIntelligence,
    system_prompt=(
        "You are 'Mr. Botsson', an expert Smartout Workspace Architect and AI Onboarding Copilot. "
        "Your mission is to interview business managers to map out their entire organization's structure. "
        "Because you are connected to a Voice Assistant (Ultravox), you must adhere to these voice rules: "
        "1. Ask ONE question at a time. Never ask multiple questions at once. "
        "2. Keep your responses short, conversational, and natural. "
        "3. Wait for the user to answer before moving on. "
        "4. Acknowledge and validate ('Flott', 'Skjønner') before asking the next question. "
        "Your objective is to map: Identity & Leadership, Seasons, Departments, Teams, Locations, Zones, Assets & Routines. "
        "You have tools to save transcriptions and generate markdown reports as you gather data."
    )
)

# ============================================================================
# 3. Agent Tools (Skills)
# ============================================================================
@onboarding_agent.tool
async def create_workspace_folder(ctx: RunContext[str], company_name: str) -> str:
    """Creates the main folder for the onboarding session and updates the context path."""
    folder = Path(ctx.deps) / company_name.replace(" ", "_").lower()
    folder.mkdir(parents=True, exist_ok=True)
    return f"Folder created at {folder}"

@onboarding_agent.tool
async def save_raw_transcription(ctx: RunContext[str], speaker: str, text: str) -> str:
    """Saves raw voice transcription statements to a log file."""
    folder = Path(ctx.deps)
    folder.mkdir(parents=True, exist_ok=True)
    transcript_file = folder / "raw_transcription.txt"
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    with open(transcript_file, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {speaker.upper()}: {text}\n")
    return "Transcription saved."

@onboarding_agent.tool
async def generate_markdown_report(ctx: RunContext[str], topic: str, content_markdown: str) -> str:
    """Saves an intermediate or finished markdown report (e.g., 'departments', 'routines')."""
    folder = Path(ctx.deps)
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"{topic.replace(' ', '_').lower()}.md"
    file_path = folder / filename
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(f"# Smartout Intelligence: {topic}\n\n")
        f.write(content_markdown)
    return f"Report {filename} saved successfully."


# ============================================================================
# 4. Ultravox Voice Integration (Pseudo-code / Skeleton)
# ============================================================================
class UltravoxVoiceController:
    """
    Mock integration for the Ultravox SDK. 
    In a real scenario, this would connect to the Ultravox WebSocket API,
    handle real-time Speech-to-Text (STT) and Text-to-Speech (TTS).
    """
    def __init__(self, agent: Agent, session_id: str):
        self.agent = agent
        # We define where this specific onboarding session's data should be stored
        self.session_folder = f"./onboarding_sessions/{session_id}"
        Path(self.session_folder).mkdir(parents=True, exist_ok=True)
        
    async def start_call(self):
        # 1. Connect to Ultravox Voice API
        print("Connected to Ultravox. Call started.")
        
        # 2. Add system prompt to Ultravox call via their REST/SDK
        # ultravox_client.set_system_prompt(self.agent.system_prompt)
        
        # 3. Simulate a conversation turn
        await self._handle_turn("Agent", "Hei, jeg er Mr. Botsson. Hva heter hotellet ditt?")
        
        # In a real app, this triggers when Ultravox sends a user transcription event
        await self.on_user_speech("Vi heter Hotell Spåtind, og dette er et høyfjellshotell.")
        
    async def on_user_speech(self, user_text: str):
        # Save exact transcript using our tool directly
        await save_raw_transcription(RunContext(deps=self.session_folder, retry=0, tool_name="save_raw_transcription"), "User", user_text)
        
        # Pass the input to Pydantic AI to decide next steps (tools or reply)
        result = await self.agent.run(user_text, deps=self.session_folder)
        
        agent_reply = result.data if isinstance(result.data, str) else result.data.json()
        
        # Save agent's reply to transcript
        await save_raw_transcription(RunContext(deps=self.session_folder, retry=0, tool_name="save_raw_transcription"), "Agent", str(agent_reply))
        
        # Send agent_reply to Ultravox to speak out loud (TTS)
        print(f"Ultravox TTS -> Speaking: {agent_reply}")
        
    async def _handle_turn(self, speaker: str, text: str):
        await save_raw_transcription(RunContext(deps=self.session_folder, retry=0, tool_name="save_raw_transcription"), speaker, text)
        if speaker == "Agent":
            print(f"Ultravox TTS -> Speaking: {text}")

if __name__ == "__main__":
    import asyncio
    
    async def main():
        controller = UltravoxVoiceController(onboarding_agent, "session_spatind_001")
        await controller.start_call()
        
    asyncio.run(main())
