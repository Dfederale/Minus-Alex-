# Minus Alex

**Digital Intelligence Neuromorphic Systems (DINS)**  
**Local-first voice, vision and desktop interaction demo for the Amazon Alexa+ / MCP contest.**

> The agent may propose. First Touch decides.

Minus Alex brings together First Hearing, First Sight, First Touch, a local Resident and an MCP bridge. The demo accepts typed or spoken instructions, recognizes explicitly saved on-screen targets and routes proposed actions through a visible execution boundary.

It is designed to demonstrate these components working together on modest hardware rather than requiring a large hosted AI service for every interaction.

The underlying application and source directories retain some historical **REFLEX** identifiers. Those internal names are intentional; the presented application is **Minus Alex**.

## One-Click Starter

Minus Alex includes a Windows starter that simplifies launching the local system.

The starter brings together the services required for the demonstration, including the application interface, local AI, MCP server and screen interaction bridge.

The goal is simple: start the system without manually opening and configuring every component.

**Local services:**

- Application interface: `127.0.0.1:4174`
- MCP server: `127.0.0.1:8787`
- Screen Bridge: `127.0.0.1:8790`
- Ollama: `127.0.0.1:11434`

The system uses the local `qwen2.5:0.5b` Resident model for the demonstration.

## External MCP Tester

Minus Alex now includes a standalone MCP tester, allowing the system's published capabilities to be tested outside the application's own Resident interface.

**Location:** [`mcp-tester/`](./mcp-tester/)

**Windows launcher:** `OPEN-MCP-TESTER.cmd`

The tester connects to the local MCP server and allows users to inspect available tools, check connectivity and submit commands, including requests to activate saved screen targets.

For example, a named-button command can travel through:

**External MCP Tester → MCP Server → First Touch → Screen Bridge**

First Touch remains responsible for authorizing execution.

The tester does not bypass the application's safety boundary. A button must already exist in the saved First Sight mapping, and window validation can reject a click if the target window has changed.

This demonstrates that Minus Alex's capabilities are accessible through an external MCP client, not only through its built-in Resident.

## First Sight, First Touch and First Hearing

**First Sight** provides the visual mapping of the environment, including explicitly saved screen targets.

**First Touch** translates authorized actions into interaction with the computer while enforcing execution checks.

**First Hearing** provides spoken-input capabilities.

Together, these components allow the local Resident to interpret instructions and interact with the desktop through a structured action pipeline.

## Local-First Architecture

Minus Alex is built around modular components that can operate on existing consumer hardware.

The demonstration combines:

- A local Resident powered by Ollama
- First Hearing for spoken instructions
- First Sight for visual target mapping
- First Touch for controlled desktop interaction
- An MCP interface for external tool access
- A Screen Bridge for executing authorized clicks

The Resident can propose actions, but tool availability does not automatically grant permission to execute them.

**The agent may propose. First Touch decides.**

## Demonstration and Safety

Minus Alex supports explicitly mapped screen targets and includes safeguards against acting on stale window positions.

When a bonded window changes, First Touch can reject execution rather than clicking potentially incorrect coordinates.

The external MCP tester uses the same proposal-and-execution boundary as the application.

The project demonstrates local AI interacting with a real desktop environment while retaining a separate authorization layer.

## Project Status

Minus Alex is a working contest demonstration and a modular subset of the broader DINS / WhisperShell architecture.

The project prioritizes practical interaction, local execution, modularity and compatibility with modest hardware.

The starter and MCP tester are included to make the demonstration easier to launch, inspect and reproduce.
