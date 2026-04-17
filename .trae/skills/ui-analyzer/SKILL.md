---
name: "ui-analyzer"
description: "Analyzes user screenshots with red arrows/boxes to identify UI issues. Invoke when user sends an image with red markings and asks for UI modifications or mentions UI problems."
---

# UI Analyzer Skill

## Purpose

This skill analyzes user screenshots that contain red arrows or red boxes to identify UI issues and determines the appropriate action based on user intent.

## When to Invoke

**MUST invoke this skill when:**
- User sends an image containing red arrows or red boxes
- User mentions "修改UI" (modify UI) or "UI问题" (UI problem)
- User points out visual issues in a screenshot

## Analysis Process

### Step 1: Identify Red Markings
Look for in the image:
- Red arrows (→) pointing to specific elements
- Red boxes/squares highlighting areas
- Red circles highlighting elements

### Step 2: Determine User Intent

**If user says "修改UI" or similar (UI modification request):**
- Make SIGNIFICANT/LARGE changes to the UI
- The bigger the change, the better
- Consider: layout restructuring, color scheme changes, spacing adjustments, font size changes, etc.
- Don't be conservative - make it noticeably different
- **IMPORTANT**: Color scheme changes must stay consistent with the project's global design system and theme colors

**If user says "功能问题" or similar (functionality issue):**
- Do NOT modify the UI
- Focus on fixing the underlying functionality
- Keep the UI appearance unchanged
- Fix JavaScript logic, API calls, data handling, etc.

### Step 3: Execute Appropriate Action

Based on the determination above:
- **UI Modification**: Search for relevant HTML/CSS files and make substantial visual changes
- **Functionality Issue**: Search for relevant JavaScript/Backend files and fix logic without changing UI

## Examples

### Example 1: UI Modification
User: [image with red arrow pointing to a button] "这个按钮太丑了，修改UI"
Action: Completely redesign the button - change colors, size, border-radius, add shadows, reposition, etc.

### Example 2: Functionality Issue  
User: [image with red box around an error message] "点击这个按钮没反应，功能有问题"
Action: Find the button's click handler in JavaScript and fix the logic, without changing the button's appearance.

## Output Format

1. **Identify**: Describe what the red arrow/box is pointing to
2. **Intent Analysis**: State whether this is a UI modification or functionality issue
3. **Action Plan**: Describe the approach (big UI changes vs. logic fixes)
4. **Execute**: Perform the appropriate modifications