# Razor Scripting Rules

## Razor Syntax Reference

### Control Structures (NO PARENTHESES!)
```razor
// CORRECT Razor syntax:
if findtype "fishing pole" backpack as pole
  hotkey 'use item in hand'
endif

while findtype "fish" backpack as fish
  dclicktype fish
  wait 1000
endwhile

// INCORRECT (C-style syntax):
if (findtype("fishing pole", backpack)) {  // WRONG!
  useitem(pole);
}
```

### Common Razor Commands
```razor
// Item operations
findtype "item name" container as variable
useitem variable
drop variable
move variable container

// Movement
There is no movement anymore, any scripts with movement is outdated

// Counters
Only way to count is by using list

removelist 'counter'
createlist 'counter'

pushlist 'counter' 1
pushlist 'counter' 1
poplist 'counter' front
poplist 'counter' front
if list 'counter' = 0
   overhead 'Reached max MIB pull limit (100)' 65
   break
 endif

// Targeting
target "target name"
waitfortarget 5000
target self

// Gumps
gumpresponse 0x12345678 1
waitforgump 0x12345678

// Waits and delays
wait 1000
waitforgump 0x12345678
waitfortarget 5000

// Variables
@setvar! MyVar 100
@setvar MyVar 200
//setvar with ! means within that script only without the exclamation it means globally saved until unsetvar command is used

//overhead to give message to player only he can see
overhead 'Message' 35 //(number is hue)

//Recall Commands
say '[recall rune name  //cast recall from any rune book that has that run name
say '[recallcharge rune name //will use a recall charge in book
say '[gatetravel rune name //will open a gate to that rune

//loops
while not dead //popular endless loop
endwhile

You can always just add loop at the end of the code, and it will cause it to loop as well
hotkey 'use item in hand'
wait 2500
loop

//there's also for loops.
        for 30 //will loop 30 times, for loops are little more complicated/harder to grasp
            overhead 'Waiting for world save...'
            wait 1000
            if insysmsg 'save complete'
                overhead 'Save complete - continue on!' 88
                replay
            endif
        endfor

// Cooldowns
//Cooldowns must be setup in the game, but is very useful for accurate timers, timers in game can go off depending on connection speed.
// If you setup a cooldown make sure you add documentation for the user to add that cooldown in game.

cooldown Fish jaseFishingCD
if not cooldown Fish
    overhead "Please setup a cooldown named:" 34
    overhead "Fish" 88
    sysmsg "Please setup a cooldown named:" 34
    sysmsg "Fish" 88
    sysmsg "Add these with 10 second cooldown" 66
    sysmsg "sysmsg: fish"
    sysmsg "sysmsg: You retrieve a"
    sysmsg "overhead: You catch"
    stop
endif
if cooldown Fish
     hotkey 'Use item in hand'
     settimer jaseFishingTimer 0
     cooldown Fish 0
endif

//timers 
if not timerexists jaseFishingTimer
    createtimer jaseFishingTimer
    settimer jaseFishingTimer jaseFishingCD
endif
if timer jaseFishingTimer >= 30000
endif

//bandaging 
//if you dont check if your not already bandaging it will just override the current bandage.
if hp < maxhp and not bandaging
     hotkey 'Bandage Self'
endif

//skill usage
skill 'begging'

/spell usage
cast 'FlameStrike'
wft
hotkey 'Target Closest Non-Friendly Monster'
or 
hotkey 'Greater Heal'
wft
target self

```

###Hotkey List
```razor
hotkey "use bandage (no timer)" /bandage
hotkey 'use item in hand' /use item in hand.
hotkey 'Target Self'
hotkey 'Bandage Self'
hotkey 'Drink Strength' //Drink strength potion
hotkey 'Drink Magic Resist' //Magic Resist pot
hotkey 'Drink Agility'
hotkey 'Target Closest Non-Friendly Monster'


```


### Essential Patterns
```razor
// Check if item exists before using
if findtype "fishing pole" backpack as pole
  lift pole
  drop self lefthand
  wait 2500 // time it takes for action to process.
else
  sysmsg "No fishing pole found!"
endif

// Clear ignores before scanning, if using ignore in the script.
// Also clear sysmsgs if using sys message
// getlabel backpack 'pingCheck' works as a ping instead of wait, much more reliable.
@clearignore
clearignore

overhead 'Select the source container'
setvar 'mibsource'
while findtype 5357 'mibsource' as 'click_mib'

    clearsysmsg
    getlabel 'click_mib' 'mib'
    overhead 'mib' 55
    wait 500
    ignore 'click_mib'
endwhile
overhead "All mibs are clicked!" 55
clearignore


```

## Core Principles

- **Prefer clear, minimal Razor**: Avoid unnecessary loops and complex logic
- **Always guard assumptions**: Don't assume items exist; use `if findtype ... as var`
- **Close control structures**: Always match `if` with `endif`, `while` with `endwhile`
- **Use proper waits**: Long loops require sleeps (`wait 200–650`) to avoid client lockups

## Critical Requirements

### Gump Interactions
- After any `gumpresponse` you MUST add `waitforgump` or `wft`
- Always verify gump state before responding
- Use appropriate wait times for gump operations

### Ignore Management
- Use `@clearignore` before ignore-heavy scans
- Pair `@ignore` operations consistently
- Clear ignores when switching between different item types

### Variable Management
- Use `@setvar!` for user-configurable values
- Never hardcode user-specific IDs unless provided
- Add comments explaining variable purposes
- Check if variables exist before using them

### Container Operations
- Verify container state with `insysmsg` when relevant
- Check container capacity before adding items
- Handle container weight limits appropriately

## Code Structure

### Headers
Always add a comment header with:
- Purpose of the script
- Required inputs/variables
- Prerequisites
- Author and date

### Control Flow
- Use clear, descriptive variable names
- Avoid deeply nested conditions
- Prefer early returns over complex nesting
- Use appropriate loop types (`while` vs `for`)

### Error Handling
- Check for item existence before operations
- Handle edge cases gracefully
- Provide meaningful error messages
- Use `overhead` for user feedback when appropriate

## Performance Guidelines

### Loops
- Add waits in long-running loops
- Use appropriate sleep times (200-650ms)
- Consider using `stop` for emergency exits

### Item Scanning
- Use efficient scanning methods
- Limit scan ranges when possible
- Clear ignores between different scan types
- Use `findtype` with appropriate parameters


## Common Patterns

### Item Finding
```razor
if find "0x48B937D5" ground -1 -1 2 as vetChest
    overhead '====Auto Detected Vet Chest====' 33
    @setvar! guildChest vetChest
  else
      overhead '====>Select Guild Chest<===' 22
    @setvar! guildChest
endif
while findtype 'map' 'lootPouch' as tmap
    getlabel tmap itemLabel
    lift tmap
    wait 250
    if 'avarite' in itemLabel
        drop guildChest 10 10 0
    else
        drop distroChest 10 10 0
    endif
endwhile

```

### Critical Item Identification Rules
- **NEVER use serial numbers in findtype**: Use item names (in quotes) or graphic IDs (numbers)
- **Use item names**: `findtype "fishing pole" backpack` or `findtype "dagger" ground`
- **Use graphic IDs**: `findtype 3520 backpack` (fishing pole ID) or `findtype 3617 backpack` (healing potion)
- **Common item IDs**: fishing pole (3520), bandage (3617), dagger (5115), hatchet (3902)
- **Examples of CORRECT usage**:
  ```razor
  if findtype "fishing pole" backpack as pole
  if findtype 3520 backpack as pole  // Same as above
  if findtype "bandage" backpack as bandage
  if findtype 3617 backpack as bandage  // Same as above
  ```
- **Examples of INCORRECT usage**:
  ```razor
  if findtype 0x0E7D backpack as pole  // WRONG - this is a serial
  if findtype 0x0E7D as pole  // WRONG - serials should not be used
  ```

### Common Item Names and IDs
**Tools and Weapons:**
- Fishing pole: "fishing pole" or 3520
- Dagger: "dagger" or 5115
- Hatchet: "hatchet" or 3902
- Bow: "bow" or 5042
- Crossbow: "crossbow" or 5055

**Consumables:**
- Bandage: "bandage" or 3617
- Greater heal potion: "greater heal potion" or 3854
- Greater cure potion: "greater cure potion" or 3852
- Greater strength potion: "greater strength potion" or 3851
- Mushroom: "mushroom" or 3342

**Containers:**
- Backpack: "backpack" or 3701
- Bag: "bag" or 3702
- Pouch: "pouch" or 3703
- Barrel: "barrel" or 3704

**Other Items:**
- Gold: "gold" or 3821
- Recall scroll: "recall scroll" or 4008
- Gate travel scroll: "gate travel scroll" or 4014
- Blank scroll: "blank scroll" or 5357

### Container Management
```razor
@clearignore
if findtype "container_type" backpack as container
    dclick container
    waitforgump 0x3C
    // Container operations
endif
```

### Skill Usage
```razor
if skill "skill_name" >= 80
    // Use skill
endif
```

## Anti-Patterns to Avoid

- **Hardcoded serial numbers in findtype**: Use item names or graphic IDs instead
- Missing `waitforgump` after `gumpresponse`
- Unbalanced control structures
- Assuming items exist without checking
- Ignoring container weight limits
- Using deprecated commands
- Using 8-character hex values (serials) in findtype commands

## Best Practices

1. **Test thoroughly**: Always test scripts in safe environments
2. **Document everything**: Comment complex logic and assumptions
3. **Handle edge cases**: Consider what happens when things go wrong
4. **Use appropriate waits**: Don't rush operations
5. **Be user-friendly**: Provide clear feedback and error messages
6. **Follow conventions**: Use consistent naming and structure
7. **Optimize for readability**: Clear code is better than clever code
