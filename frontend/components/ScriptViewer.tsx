import React, { useState, useEffect } from 'react'
import { Copy, Download, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

interface ScriptViewerProps {
  code: string
  language?: string
  title?: string
  showLineNumbers?: boolean
  maxHeight?: string
  className?: string
}

const ScriptViewer: React.FC<ScriptViewerProps> = ({
  code,
  language = 'razorscript',
  title,
  showLineNumbers = true,
  maxHeight = '500px',
  className = ''
}) => {
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [showLineNumbersState, setShowLineNumbersState] = useState(showLineNumbers)

  // Syntax highlighting colors (matching the reference image)
  const syntaxColors = {
    comments: '#6a9955',      // Comments (green)
    strings: '#98C379',       // Strings (light green)
    numbers: '#C678DD',       // Numbers (purple)
    keywords: '#D19A66',      // Keywords like if, endif, while, endwhile, else, and, not (orange)
    functions: '#61AFEF',     // Functions like findbuff, findtype, find, diffhits, targetexists, self (red/blue)
    commands: '#61AFEF',      // Commands like getlabel, dclick, dclicktype, wait, overhead, sysmsg, target (blue)
    variables: '#ABB2BF',     // Variables (white/light gray)
    default: '#ABB2BF'        // Default text (white/light gray)
  }

  // Clean code by removing ALL embedded color codes
  const cleanCode = (code: string): string => {
    let cleaned = code
    
    // Remove ALL possible embedded color code patterns
    cleaned = cleaned.replace(/#[0-9a-fA-F]{6}">"color: #[0-9a-fA-F]{6}">/g, '')
    cleaned = cleaned.replace(/@#[0-9a-fA-F]{6}">"color: #[0-9a-fA-F]{6}">/g, '')
    cleaned = cleaned.replace(/#[0-9a-fA-F]{6}">/g, '')
    cleaned = cleaned.replace(/@#[0-9a-fA-F]{6}">/g, '')
    cleaned = cleaned.replace(/"color: #[0-9a-fA-F]{6}">/g, '')
    cleaned = cleaned.replace(/@\"color: #[0-9a-fA-F]{6}">/g, '')
    cleaned = cleaned.replace(/^"color: #[0-9a-fA-F]{6}">/gm, '')
    cleaned = cleaned.replace(/^@"color: #[0-9a-fA-F]{6}">/gm, '')
    cleaned = cleaned.replace(/color: #[0-9a-fA-F]{6}/g, '')
    cleaned = cleaned.replace(/#[0-9a-fA-F]{6}/g, '')
    cleaned = cleaned.replace(/@#[0-9a-fA-F]{6}/g, '')
    cleaned = cleaned.replace(/"[^"]*color:[^"]*">/g, '')
    
    return cleaned.trim()
  }

  // Parse code into tokens for React rendering
  const parseCodeToTokens = (code: string) => {
    const cleaned = cleanCode(code)
    const lines = cleaned.split('\n')
    
    return lines.map((line, lineIndex) => {
      const tokens = []
      let remaining = line
      let position = 0
      
      // Comments (green) - lines starting with # or //
      if (line.trim().startsWith('#') || line.trim().startsWith('//')) {
        return {
          type: 'comment',
          content: line,
          color: '#6a9955'
        }
      }
      
      // Keywords (orange) - only exact word matches
      const keywords = ['if', 'endif', 'elseif', 'while', 'endwhile', 'else', 'and', 'not', 'or', 'true', 'false', 'null', 'as']
      // Functions (blue) - only exact word matches
      const functions = [
        'findtype', 'getlabel', 'dclick', 'wait', 'overhead', 'sysmsg', 'target', 'lift', 'drop', 
        'droprelloc', 'maxwaittimeinms', 'settimer', 'createtimer', 'removetimer', 
        'timerexists', 'findbuff', 'find', 'diffhits', 'targetexists', 'self', 'menu',
        'gumpresponse', 'say', 'pause', 'gumpexists', 'setvar', 'findlayer', 'lhandempty', 'righthand',
        'waitforgump', 'waitformenu', 'waitforprompt', 'waitfortarget', 'waitforsysmsg', 'warmode',
        'dclicktype', 'backpack', 'removelist', 'createlist', 'pushlist', 'poplist'
      ]
      // Special functions (red) - only exact word matches
      const specialFunctions = [
        'insysmsg', 'timer', 'ingump', 'inlist'
      ]
      
      // Process the line token by token
      while (remaining.length > 0) {
        let matched = false
        
        // Check for strings first
        const stringMatch = remaining.match(/^"([^"]*)"/)
        if (stringMatch) {
          tokens.push({
            type: 'string',
            content: stringMatch[0],
            color: '#ce9178'
          })
          remaining = remaining.substring(stringMatch[0].length)
          matched = true
        }
        
        // Check for single quotes
        const singleQuoteMatch = remaining.match(/^'([^']*)'/)
        if (singleQuoteMatch) {
          tokens.push({
            type: 'string',
            content: singleQuoteMatch[0],
            color: '#ce9178'
          })
          remaining = remaining.substring(singleQuoteMatch[0].length)
          matched = true
        }
        
        // Check for @ variables
        const variableMatch = remaining.match(/^@(\w+!?)/)
        if (variableMatch) {
          tokens.push({
            type: 'variable',
            content: variableMatch[0],
            color: '#9cdcfe'
          })
          remaining = remaining.substring(variableMatch[0].length)
          matched = true
        }
        
        // Check for numbers
        const numberMatch = remaining.match(/^\d+/)
        if (numberMatch) {
          tokens.push({
            type: 'number',
            content: numberMatch[0],
            color: '#b5cea8'
          })
          remaining = remaining.substring(numberMatch[0].length)
          matched = true
        }
        
        // Check for keywords with word boundaries
        if (!matched) {
          let keywordMatched = false
          for (const keyword of keywords) {
            const regex = new RegExp(`^\\b${keyword}\\b`)
            const match = remaining.match(regex)
            if (match) {
              tokens.push({
                type: 'keyword',
                content: match[0],
                color: '#D19A66'
              })
              remaining = remaining.substring(match[0].length)
              keywordMatched = true
              break
            }
          }
          if (keywordMatched) matched = true
        }
        
        // Check for special functions (red) with word boundaries
        if (!matched) {
          let specialFunctionMatched = false
          for (const func of specialFunctions) {
            const regex = new RegExp(`^\\b${func}\\b`)
            const match = remaining.match(regex)
            if (match) {
              tokens.push({
                type: 'special-function',
                content: match[0],
                color: '#ff6b6b'
              })
              remaining = remaining.substring(match[0].length)
              specialFunctionMatched = true
              break
            }
          }
          if (specialFunctionMatched) matched = true
        }
        
        // Check for regular functions (blue) with word boundaries
        if (!matched) {
          let functionMatched = false
          for (const func of functions) {
            const regex = new RegExp(`^\\b${func}\\b`)
            const match = remaining.match(regex)
            if (match) {
              tokens.push({
                type: 'function',
                content: match[0],
                color: '#4fc1ff'
              })
              remaining = remaining.substring(match[0].length)
              functionMatched = true
              break
            }
          }
          if (functionMatched) matched = true
        }
        
        // If no match, add as default text
        if (!matched) {
          const nextChar = remaining[0]
          tokens.push({
            type: 'default',
            content: nextChar,
            color: '#d4d4d4'
          })
          remaining = remaining.substring(1)
        }
      }
      
      return {
        lineIndex,
        tokens
      }
    })
  }

  // Basic syntax highlighting for RazorScript
  const highlightCode = (code: string): string => {
    let highlighted = code

    // Keywords (RazorScript specific)
    const keywords = [
      'if', 'elseif', 'else', 'endif', 'while', 'endwhile', 'for', 'endfor',
      'stop', 'not', 'and', 'or', 'true', 'false', 'null'
    ]
    
    // Functions/Commands
    const functions = [
      'findtype', 'dclick', 'lift', 'drop', 'say', 'wait', 'waitforgump',
      'gumpresponse', 'overhead', 'cast', 'skill', 'sysmsg', 'wft',
      'lasttarget', 'ingump', 'setvar', 'getvar', 'finditem', 'findlayer',
      'findalias', 'findobject', 'findgump', 'findtext', 'findgraphic',
      'findcolor', 'findhue', 'findtype', 'finditem', 'findlayer'
    ]

    // Highlight keywords
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g')
      highlighted = highlighted.replace(regex, `<span style="color: ${syntaxColors.keywords}">${keyword}</span>`)
    })

    // Highlight functions
    functions.forEach(func => {
      const regex = new RegExp(`\\b${func}\\b`, 'g')
      highlighted = highlighted.replace(regex, `<span style="color: ${syntaxColors.functions}">${func}</span>`)
    })

    // Highlight strings (double quotes)
    highlighted = highlighted.replace(/"([^"]*)"/g, `<span style="color: ${syntaxColors.strings}">"$1"</span>`)

    // Highlight numbers
    highlighted = highlighted.replace(/\b(\d+)\b/g, `<span style="color: ${syntaxColors.numbers}">$1</span>`)

    // Highlight comments (// and #)
    highlighted = highlighted.replace(/(\/\/.*$|#.*$)/gm, `<span style="color: ${syntaxColors.comments}">$1</span>`)

    // Highlight @setvar! and similar directives
    highlighted = highlighted.replace(/@(\w+!?)/g, `<span style="color: ${syntaxColors.keywords}">@$1</span>`)

    return highlighted
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Code copied to clipboard!')
    } catch (err) {
      toast.error('Failed to copy code')
    }
  }

  const downloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = title ? `${title}.txt` : 'script.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Script downloaded!')
  }

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen)
  }

  const toggleLineNumbers = () => {
    setShowLineNumbersState(!showLineNumbersState)
  }


  // Parse code into tokens for React rendering
  const parsedLines = parseCodeToTokens(code)
  const lines = parsedLines.map(line => line.content || (line.tokens ? line.tokens.map(token => token.content).join('') : ''))

  const containerStyle: React.CSSProperties = {
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Mono", Menlo, Consolas, monospace',
    fontSize: '13px',
    lineHeight: '1.5',
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    border: '1px solid #3c3c3c',
    borderRadius: '8px',
    overflow: 'hidden',
    position: isFullScreen ? 'fixed' : 'relative',
    top: isFullScreen ? '0' : 'auto',
    left: isFullScreen ? '0' : 'auto',
    width: isFullScreen ? '100vw' : '100%',
    height: isFullScreen ? '100vh' : maxHeight,
    zIndex: isFullScreen ? 9999 : 'auto',
    maxHeight: isFullScreen ? 'none' : maxHeight
  }

  const codeContainerStyle: React.CSSProperties = {
    display: 'flex',
    height: '100%',
    overflow: 'hidden'
  }

  const lineNumbersStyle: React.CSSProperties = {
    backgroundColor: '#2d2d30',
    color: '#858585',
    padding: '20px 8px 20px 8px',
    borderRight: '1px solid #3c3c3c',
    userSelect: 'none',
    minWidth: '60px',
    textAlign: 'right',
    fontSize: '12px',
    lineHeight: '1.5',
    flexShrink: 0
  }

  const codeStyle: React.CSSProperties = {
    flex: 1,
    padding: '20px 16px',
    overflow: 'auto',
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    whiteSpace: 'pre',
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Mono", Menlo, Consolas, monospace',
    fontSize: '13px',
    lineHeight: '1.5',
    border: 'none',
    outline: 'none'
  }

  const toolbarStyle: React.CSSProperties = {
    position: 'absolute',
    top: '8px',
    right: '8px',
    display: 'flex',
    gap: '8px',
    zIndex: 10
  }

  const buttonStyle: React.CSSProperties = {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    color: '#d4d4d4',
    padding: '6px 8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    transition: 'background-color 0.2s'
  }

  return (
    <div className={`relative ${className}`}>
      <div style={containerStyle}>
        {/* Toolbar */}
        <div style={toolbarStyle}>
          <button
            style={buttonStyle}
            onClick={toggleLineNumbers}
            title="Toggle line numbers"
          >
            {showLineNumbersState ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            style={buttonStyle}
            onClick={copyToClipboard}
            title="Copy code"
          >
            <Copy size={14} />
          </button>
          <button
            style={buttonStyle}
            onClick={downloadCode}
            title="Download script"
          >
            <Download size={14} />
          </button>
          <button
            style={buttonStyle}
            onClick={toggleFullScreen}
            title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullScreen ? '⤢' : '⤡'}
          </button>
        </div>

        {/* Code Display */}
        <div style={codeContainerStyle}>
          <div style={codeStyle}>
            {parsedLines.map((line, index) => (
              <div key={index} style={{ display: 'flex' }}>
                {showLineNumbersState && (
                  <div style={{
                    backgroundColor: '#2d2d30',
                    color: '#858585',
                    paddingRight: '8px',
                    marginRight: '8px',
                    borderRight: '1px solid #3c3c3c',
                    userSelect: 'none',
                    minWidth: '52px',
                    textAlign: 'right',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    flexShrink: 0
                  }}>
                    {index + 1}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  {line.type === 'comment' ? (
                    <span style={{ color: line.color }}>{line.content}</span>
                  ) : (
                    line.tokens ? line.tokens.map((token, tokenIndex) => (
                      <span key={tokenIndex} style={{ color: token.color }}>
                        {token.content}
                      </span>
                    )) : <span>{line.content}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {isFullScreen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 9998
          }}
          onClick={toggleFullScreen}
        />
      )}
    </div>
  )
}

export default ScriptViewer
