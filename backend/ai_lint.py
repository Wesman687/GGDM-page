import re
from typing import List

def lint_razor(code: str) -> List[str]:
    """Perform basic linting checks on Razor script code."""
    issues = []
    
    if not code.strip():
        return ["Empty code block"]
    
    # Check for balanced control structures
    if_count = len(re.findall(r'\bif\s+', code, re.IGNORECASE))
    endif_count = len(re.findall(r'\bendif\b', code, re.IGNORECASE))
    if if_count != endif_count:
        issues.append(f"Unbalanced if/endif: {if_count} if statements, {endif_count} endif statements")
    
    while_count = len(re.findall(r'\bwhile\s+', code, re.IGNORECASE))
    endwhile_count = len(re.findall(r'\bendwhile\b', code, re.IGNORECASE))
    if while_count != endwhile_count:
        issues.append(f"Unbalanced while/endwhile: {while_count} while statements, {endwhile_count} endwhile statements")
    
    for_count = len(re.findall(r'\bfor\s+', code, re.IGNORECASE))
    endfor_count = len(re.findall(r'\bendfor\b', code, re.IGNORECASE))
    if for_count != endfor_count:
        issues.append(f"Unbalanced for/endfor: {for_count} for statements, {endfor_count} endfor statements")
    
    # Check for gumpresponse without waitforgump
    gumpresponse_pattern = r'gumpresponse\s+\d+\s+\w+'
    gumpresponses = re.findall(gumpresponse_pattern, code, re.IGNORECASE)
    
    for gump in gumpresponses:
        # Check if there's a waitforgump or wft within reasonable distance
        gump_pos = code.lower().find(gump.lower())
        next_50_chars = code[gump_pos:gump_pos + 200]
        
        if not re.search(r'(waitforgump|wft)', next_50_chars, re.IGNORECASE):
            issues.append(f"gumpresponse without immediate wait: {gump}")
    
    # Check for potential infinite loops without waits
    loop_patterns = [
        r'while\s+[^{]*\{[^}]*\}',
        r'for\s+[^{]*\{[^}]*\}'
    ]
    
    for pattern in loop_patterns:
        loops = re.findall(pattern, code, re.IGNORECASE | re.DOTALL)
        for loop in loops:
            if not re.search(r'\b(wait|sleep|pause)\b', loop, re.IGNORECASE):
                issues.append("Loop without wait/sleep - may cause client lockup")
                break  # Only report once per loop type
    
    # Check for hardcoded IDs (common issue)
    hardcoded_ids = re.findall(r'\b\d{8,}\b', code)
    if hardcoded_ids:
        issues.append(f"Potential hardcoded IDs detected: {', '.join(hardcoded_ids[:3])}")
    
    # Check for missing @clearignore before ignore-heavy operations
    ignore_ops = re.findall(r'\b(ignore|@ignore)\b', code, re.IGNORECASE)
    clearignore_ops = re.findall(r'\b@clearignore\b', code, re.IGNORECASE)
    
    if len(ignore_ops) > 2 and len(clearignore_ops) == 0:
        issues.append("Multiple ignore operations without @clearignore")
    
    # Check for proper variable declarations
    setvar_pattern = r'@setvar!\s+(\w+)'
    variables = re.findall(setvar_pattern, code, re.IGNORECASE)
    
    # Check if variables are used before being set
    for var in variables:
        var_usage = re.findall(rf'\b{var}\b', code, re.IGNORECASE)
        if len(var_usage) > 1:  # More than just the declaration
            # Check if usage comes before declaration
            var_pos = code.lower().find(f'@setvar! {var.lower()}')
            usage_positions = [m.start() for m in re.finditer(rf'\b{var}\b', code, re.IGNORECASE)]
            
            for pos in usage_positions:
                if pos < var_pos:
                    issues.append(f"Variable '{var}' used before declaration")
                    break
    
    return issues

def extract_code_from_response(response: str) -> str:
    """Extract code block from AI response."""
    # Look for code blocks in markdown format
    code_pattern = r'```(?:razor|razorscript)?\s*\n(.*?)\n```'
    match = re.search(code_pattern, response, re.DOTALL | re.IGNORECASE)
    
    if match:
        return match.group(1).strip()
    
    # Look for code blocks without language specification
    code_pattern = r'```\s*\n(.*?)\n```'
    match = re.search(code_pattern, response, re.DOTALL)
    
    if match:
        return match.group(1).strip()
    
    # If no code blocks found, return the whole response
    return response.strip()
