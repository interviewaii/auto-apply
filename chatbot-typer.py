"""
Naukri Chatbot Typer - PyAutoGUI Helper
---------------------------------------
This script types answers into the Naukri chatbot input field.
Called by the Node.js app: python chatbot-typer.py "answer_text"

It works at the OS level (real mouse clicks + keyboard) so it
bypasses all DOM/iframe/context issues that Puppeteer has.
"""

import sys
import time
import json
import pyautogui
import pyperclip

# Safety settings
pyautogui.FAILSAFE = True  # Move mouse to corner to abort
pyautogui.PAUSE = 0.3       # Small pause between actions

def find_chat_input():
    """
    Try to find the chat input field on screen.
    Strategy: Look for the "Type message here..." text box area.
    Falls back to clicking near bottom-center of the active window.
    """
    # Get the active window (should be Chrome with Naukri)
    try:
        active_window = pyautogui.getActiveWindow()
        if active_window:
            win_left = active_window.left
            win_top = active_window.top
            win_width = active_window.width
            win_height = active_window.height
            
            # The chatbot input is typically at the bottom-center of the modal
            # Modal is usually centered on screen
            # Input field is near the bottom of the modal
            
            # Click at roughly 50% horizontal, 75% vertical of the window
            # This targets the chatbot input area in most layouts
            click_x = win_left + (win_width // 2)
            click_y = win_top + int(win_height * 0.70)
            
            return click_x, click_y
    except Exception as e:
        print(f"[Python] Window detection error: {e}", file=sys.stderr)
    
    # Fallback: use screen center
    screen_w, screen_h = pyautogui.size()
    return screen_w // 2, int(screen_h * 0.65)


def find_save_button():
    """
    Try to find the Save/Submit button.
    It's typically below the input field.
    """
    try:
        active_window = pyautogui.getActiveWindow()
        if active_window:
            win_left = active_window.left
            win_top = active_window.top
            win_width = active_window.width
            win_height = active_window.height
            
            # Save button is usually at bottom-right of the chatbot modal
            click_x = win_left + int(win_width * 0.55)
            click_y = win_top + int(win_height * 0.78)
            
            return click_x, click_y
    except Exception as e:
        print(f"[Python] Save button detection error: {e}", file=sys.stderr)
    
    screen_w, screen_h = pyautogui.size()
    return int(screen_w * 0.55), int(screen_h * 0.75)


def type_answer(answer_text):
    """
    Type the answer into the chatbot input and click Save.
    Uses clipboard paste for reliability (handles special chars).
    """
    print(f"[Python] Typing answer: '{answer_text}'")
    
    # Step 1: Find and click the input field
    input_x, input_y = find_chat_input()
    print(f"[Python] Clicking input at ({input_x}, {input_y})")
    pyautogui.click(input_x, input_y)
    time.sleep(0.5)
    
    # Step 2: Press Tab to make sure we're in the input
    pyautogui.press('tab')
    time.sleep(0.3)
    
    # Step 3: Clear any existing text
    pyautogui.hotkey('ctrl', 'a')
    time.sleep(0.2)
    pyautogui.press('delete')
    time.sleep(0.2)
    
    # Step 4: Type the answer using clipboard (faster + handles special chars)
    try:
        pyperclip.copy(answer_text)
        pyautogui.hotkey('ctrl', 'v')
        print(f"[Python] Pasted: '{answer_text}'")
    except Exception:
        # Fallback: type character by character
        pyautogui.typewrite(answer_text, interval=0.05)
        print(f"[Python] Typed: '{answer_text}'")
    
    time.sleep(0.5)
    
    # Step 5: Click Save button
    save_x, save_y = find_save_button()
    print(f"[Python] Clicking Save at ({save_x}, {save_y})")
    pyautogui.click(save_x, save_y)
    time.sleep(0.3)
    
    print("[Python] Done!")
    return True


def main():
    """
    Main entry point.
    Usage: python chatbot-typer.py "answer_text"
    Or:    python chatbot-typer.py --json '{"answer":"3","action":"type"}'
    """
    if len(sys.argv) < 2:
        print("Usage: python chatbot-typer.py <answer_text>", file=sys.stderr)
        print('   or: python chatbot-typer.py --json \'{"answer":"3","action":"type"}\'', file=sys.stderr)
        sys.exit(1)
    
    # Parse arguments
    if sys.argv[1] == "--json":
        data = json.loads(sys.argv[2])
        answer = data.get("answer", "3")
        action = data.get("action", "type")
    else:
        answer = sys.argv[1]
        action = "type"
    
    # Small delay to let the user switch to Chrome if needed
    print(f"[Python] Action: {action}, Answer: '{answer}'")
    print("[Python] Starting in 1 second...")
    time.sleep(1)
    
    if action == "type":
        success = type_answer(answer)
        if success:
            print(json.dumps({"status": "success", "typed": answer}))
        else:
            print(json.dumps({"status": "error", "message": "Failed to type"}))
            sys.exit(1)
    elif action == "click_save":
        save_x, save_y = find_save_button()
        pyautogui.click(save_x, save_y)
        print(json.dumps({"status": "success", "action": "click_save"}))
    else:
        print(f"Unknown action: {action}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
