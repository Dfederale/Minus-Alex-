# Minus Alex

**Digital Intelligence Neuromorphic Systems (DINS)**  
**Local-first voice, vision and desktop interaction demo for the Amazon Alexa+ / MCP contest.**

> The Resident decides. First Touch executes.

Minus Alex brings together First Hearing, First Sight, First Touch, a local Resident and an MCP bridge.

The demo accepts typed or spoken instructions, captures visual information, and enables the Resident to interact with the desktop through explicitly mapped targets and executable tools.

It demonstrates these components working together on modest hardware without requiring a large hosted AI service for every interaction.

The underlying application and source directories retain historical **REFLEX** identifiers. Those internal names are intentional; the presented application is **Minus Alex**.

## Core Components

**First Hearing** provides spoken input to the system.

**First Sight** captures visual information from the environment. It supplies observations and screen information without independently interpreting or identifying objects.

**Resident** processes available information, interprets instructions and selects actions.

**First Touch** carries out executable instructions, including mouse interactions. It also supports execution checks to prevent unsafe clicks when the target window has changed.

**MCP Bridge** exposes supported capabilities to external MCP clients.

## One-Click Starter

Minus Alex includes a Windows starter that launches the local demonstration services.

The system uses:

- Application interface: `127.0.0.1:4174`
- MCP server: `127.0.0.1:8787`
- Screen Bridge: `127.0.0.1:8790`
- Ollama: `127.0.0.1:11434`

The demonstration uses the local `qwen2.5:0.5b` Resident model.

## External MCP Tester

A standalone MCP tester is included in the [`mcp-tester/`](./mcp-tester/) directory.

Launch it on Windows using `OPEN-MCP-TESTER.cmd`.

The tester connects to the local MCP server and supports checking connectivity, listing tools and submitting commands to the application.

For example:

**MCP Tester → MCP Server → Action Proposal → First Touch → Screen Bridge**

The tester can request activation of previously mapped screen targets.

The execution system verifies the current target conditions. If a bonded window has changed, a click can be rejected rather than executed at an incorrect position.

This allows external MCP clients to use Minus Alex's desktop interaction capabilities without bypassing the existing execution checks.

## Local-First Architecture

Minus Alex combines a local AI Resident, visual and audio input, desktop interaction and external MCP connectivity.

The components are modular and designed to operate on existing consumer hardware.

The Resident can interpret instructions and select actions. First Touch provides the execution mechanism, while First Sight supplies visual information.

The system separates observation, interpretation and execution.

## Project Status

Minus Alex is a working Amazon contest demonstration and a modular subset of the broader DINS / WhisperShell architecture.

The project focuses on local execution, modularity, practical desktop interaction and compatibility with modest hardware.

A one-click Windows starter and standalone MCP tester are included to make the system easier to launch, test and demonstrate.
