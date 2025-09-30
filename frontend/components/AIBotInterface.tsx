import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, ThumbsUp, ThumbsDown, Edit3, Copy, ExternalLink } from 'lucide-react'
import { AIBotRequest, AIBotResponse, AIFeedbackSubmit, apiService } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import ScriptViewer from './ScriptViewer'
import toast from 'react-hot-toast'

// Function to clean code from AI response by removing HTML color tags and extracting from markdown
const cleanCodeFromAI = (code: string): string => {
  let cleaned = code
  
  // First, extract code from markdown code blocks if present
  const codeBlockMatch = cleaned.match(/```(?:razor|razorscript)?\s*\n([\s\S]*?)\n```/)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1]
  }
  
  // Remove ALL embedded color codes with a comprehensive approach
  // This will catch all variations of embedded color codes
  
  // Pattern 1: Remove "color: #XXXXXX"> patterns anywhere
  cleaned = cleaned.replace(/"color: #[0-9a-fA-F]{6}">/g, '')
  
  // Pattern 2: Remove @#XXXXXX"> patterns anywhere
  cleaned = cleaned.replace(/@#[0-9a-fA-F]{6}">/g, '')
  
  // Pattern 3: Remove #XXXXXX"> patterns anywhere
  cleaned = cleaned.replace(/#[0-9a-fA-F]{6}">/g, '')
  
  // Pattern 4: Remove complex sequences like @#XXXXXX">"color: #XXXXXX">
  cleaned = cleaned.replace(/@#[0-9a-fA-F]{6}">"color: #[0-9a-fA-F]{6}">/g, '')
  
  // Pattern 5: Remove any remaining color patterns with quotes
  cleaned = cleaned.replace(/"[^"]*color:[^"]*">/g, '')
  
  // Pattern 6: Remove any hex color codes followed by ">
  cleaned = cleaned.replace(/#[0-9a-fA-F]{6}">/g, '')
  
  // Pattern 7: Remove any @ followed by hex color codes and ">
  cleaned = cleaned.replace(/@#[0-9a-fA-F]{6}">/g, '')
  
  // Pattern 8: Remove standalone hex color codes followed by ">
  cleaned = cleaned.replace(/#[0-9a-fA-F]{6}">/g, '')
  
  // Pattern 9: Remove any remaining color-related patterns
  cleaned = cleaned.replace(/color:\s*#[0-9a-fA-F]{6}/g, '')
  
  // Pattern 10: Remove any remaining hex color codes
  cleaned = cleaned.replace(/#[0-9a-fA-F]{6}/g, '')
  
  // Pattern 11: Remove any remaining @ followed by hex color codes
  cleaned = cleaned.replace(/@#[0-9a-fA-F]{6}/g, '')
  
  // Pattern 12: Remove any remaining "color: patterns
  cleaned = cleaned.replace(/"color:/g, '')
  
  // Pattern 13: Remove any remaining "> patterns
  cleaned = cleaned.replace(/">/g, '')
  
  // Pattern 14: Remove any remaining @ patterns that might be color codes
  cleaned = cleaned.replace(/@#[0-9a-fA-F]{6}/g, '')
  
  // Final cleanup - remove any remaining color-related patterns
  cleaned = cleaned.replace(/color:\s*#[0-9a-fA-F]{6}/g, '')
  cleaned = cleaned.replace(/#[0-9a-fA-F]{6}/g, '')
  
  return cleaned.trim()
}

interface AIMessage {
  id: string
  type: 'user' | 'ai' | 'system'
  content: string
  code?: string
  citations?: Array<{ title: string; url: string }>
  timestamp: Date
  sessionId: string
  feedback?: {
    decision: 'approved' | 'declined' | 'edited'
    rating?: number
    edits?: string
  }
  isEditing?: boolean
  editedCode?: string
  suggestedRules?: string[]
  scriptSuggestions?: Array<{
    id: string
    title: string
    author: string
    description: string
    rating: number
    is_featured: boolean
    tags: string
    url: string
    relevance_reason: string
  }>
}

interface AIBotInterfaceProps {
  isOpen: boolean
  onClose: () => void
  initialQuery?: string
}

const AIBotInterface: React.FC<AIBotInterfaceProps> = ({
  isOpen,
  onClose,
  initialQuery = ''
}) => {
  const { user } = useAuth()
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [inputValue, setInputValue] = useState(initialQuery)
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editCode, setEditCode] = useState('')
  const [showRuleSuggestions, setShowRuleSuggestions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when interface opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Add initial query if provided
  useEffect(() => {
    if (initialQuery && isOpen && messages.length === 0) {
      setInputValue(initialQuery)
    }
  }, [initialQuery, isOpen, messages.length])

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || !user?.discordId) return

    const userMessage: AIMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      sessionId
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const request: AIBotRequest = {
        question: inputValue.trim(),
        session_id: sessionId,
        k: 8,
        rules_version: 'rules-v1.0'
      }

      const response = await apiService.aiSearch(request, user.discordId)

      // Clean the code by removing HTML color tags
      const cleanCode = response.code ? cleanCodeFromAI(response.code) : undefined

      // Parse the AI response to separate explanation from code
      const parseAIResponse = (answer: string) => {
        // Remove code blocks from the explanation
        let explanation = answer
        
        // Remove ```razor code blocks
        explanation = explanation.replace(/```razor\s*\n[\s\S]*?\n```/g, '')
        
        // Remove any remaining ``` code blocks
        explanation = explanation.replace(/```[\s\S]*?```/g, '')
        
        // Clean up markdown formatting
        explanation = explanation
          .replace(/### /g, '') // Remove ### headers
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold** formatting
          .replace(/\*(.*?)\*/g, '$1') // Remove *italic* formatting
          .replace(/^\s*[-*+]\s+/gm, '• ') // Convert list items to bullet points
          .trim()
        
        return explanation
      }

      const cleanExplanation = parseAIResponse(response.answer)

      const aiMessage: AIMessage = {
        id: crypto.randomUUID(),
        type: 'ai',
        content: cleanExplanation,
        code: cleanCode,
        citations: response.citations,
        scriptSuggestions: response.script_suggestions || [],
        timestamp: new Date(),
        sessionId
      }

      setMessages(prev => [...prev, aiMessage])
    } catch (error: any) {
      const errorMessage: AIMessage = {
        id: crypto.randomUUID(),
        type: 'system',
        content: `Error: ${error.message || 'Failed to get AI response'}`,
        timestamp: new Date(),
        sessionId
      }
      setMessages(prev => [...prev, errorMessage])
      toast.error('Failed to get AI response')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const submitFeedback = async (messageId: string, decision: 'approved' | 'declined' | 'edited', rating?: number, edits?: string) => {
    if (!user?.discordId) return

    const message = messages.find(m => m.id === messageId)
    if (!message || message.type !== 'ai') return

    try {
      const feedback: AIFeedbackSubmit = {
        id: sessionId,
        question: messages.find(m => m.type === 'user' && m.timestamp < message.timestamp)?.content || '',
        assistant_output: {
          explanation: message.content,
          code: message.code
        },
        human_feedback: {
          decision,
          ...(edits && { edits_diff: edits }),
          ...(rating && { rating })
        },
        rules_version: 'rules-v1.0',
        model_version: '1.0.0',
        rating
      }

      await apiService.submitAIFeedback(feedback, user.discordId)

      // Update message with feedback
      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { ...m, feedback: { decision, rating, edits } }
          : m
      ))

      toast.success('Feedback submitted successfully!')
    } catch (error: any) {
      toast.error('Failed to submit feedback')
    }
  }

  const startEditing = (messageId: string) => {
    const message = messages.find(m => m.id === messageId)
    if (message?.code) {
      setEditingMessageId(messageId)
      setEditCode(message.code)
      setShowRuleSuggestions(false)
    }
  }

  const cancelEditing = () => {
    setEditingMessageId(null)
    setEditCode('')
    setShowRuleSuggestions(false)
  }

  const saveEdit = async (messageId: string) => {
    if (!user?.discordId) return

    const message = messages.find(m => m.id === messageId)
    if (!message || message.type !== 'ai') return

    // Generate rule suggestions based on changes
    const originalCode = message.code || ''
    const changes = generateRuleSuggestions(originalCode, editCode)

    try {
      // Update the message with edited code
      setMessages(prev => prev.map(m => 
        m.id === messageId 
          ? { 
              ...m, 
              editedCode: editCode,
              suggestedRules: changes.ruleSuggestions,
              isEditing: false
            }
          : m
      ))

      // Submit feedback with the edited code
      await submitFeedback(messageId, 'edited', undefined, editCode)

      setEditingMessageId(null)
      setEditCode('')
      setShowRuleSuggestions(true)
      
      toast.success('Code edited and feedback submitted!')
    } catch (error: any) {
      toast.error('Failed to save edit')
    }
  }

  const generateRuleSuggestions = (originalCode: string, editedCode: string): { ruleSuggestions: string[] } => {
    const suggestions: string[] = []
    
    // Check for common issues and generate rule suggestions
    if (originalCode.includes('0x') && !editedCode.includes('0x')) {
      suggestions.push('NEVER use serial numbers in findtype - use item names or graphic IDs instead')
    }
    
    if (editedCode.includes('findtype') && editedCode.includes('"')) {
      suggestions.push('Good use of item names in findtype commands')
    }
    
    if (editedCode.includes('waitforgump') && !originalCode.includes('waitforgump')) {
      suggestions.push('Always add waitforgump after gumpresponse commands')
    }
    
    if (editedCode.includes('@clearignore') && !originalCode.includes('@clearignore')) {
      suggestions.push('Use @clearignore before ignore-heavy scans')
    }
    
    if (editedCode.includes('if findtype') && editedCode.includes('as ')) {
      suggestions.push('Good practice: Use "as" operator to capture findtype results')
    }
    
    return { ruleSuggestions: suggestions }
  }

  const submitRuleSuggestion = async (suggestion: string) => {
    if (!user?.discordId) return

    try {
      // Submit rule suggestion to backend
      await apiService.submitRuleSuggestion({
        suggestion,
        sessionId,
        userId: user.discordId
      })
      
      toast.success('Rule suggestion submitted!')
    } catch (error: any) {
      toast.error('Failed to submit rule suggestion')
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard!')
    } catch (err) {
      toast.error('Failed to copy text')
    }
  }

  const openCitation = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Bot className="text-purple-600" size={24} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Script Assistant</h2>
              <p className="text-sm text-gray-500">Ask me anything about scripts!</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <Bot size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">Welcome to AI Script Assistant!</p>
              <p className="text-sm">Ask me to find, create, or modify scripts. Try:</p>
              <ul className="text-sm mt-2 space-y-1">
                <li>• "Create a fishing script"</li>
                <li>• "Find healing scripts"</li>
                <li>• "Show me dungeon farming scripts"</li>
              </ul>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type !== 'user' && (
                <div className="flex-shrink-0">
                  {message.type === 'ai' ? (
                    <Bot className="text-purple-600 mt-1" size={20} />
                  ) : (
                    <div className="w-5 h-5 bg-gray-400 rounded-full mt-1" />
                  )}
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.type === 'ai'
                    ? 'bg-gray-100 text-gray-900'
                    : 'bg-red-100 text-red-900'
                }`}
              >
                {/* Message Content */}
                <div className="whitespace-pre-wrap">{message.content}</div>

                {/* Code Block */}
                {message.code && (
                  <div className="mt-3">
                    {editingMessageId === message.id ? (
                      <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-medium text-sm text-gray-700">Edit Code:</h4>
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(message.id)}
                              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                        <textarea
                          ref={editTextareaRef}
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                          className="w-full h-64 p-3 font-mono text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Edit the code here..."
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <ScriptViewer
                          code={message.editedCode || message.code}
                          language="razorscript"
                          maxHeight="300px"
                          showLineNumbers={true}
                        />
                        
                        {/* Edit Button */}
                        {!message.feedback && (
                          <button
                            onClick={() => startEditing(message.id)}
                            className="absolute top-2 right-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors opacity-80 hover:opacity-100"
                          >
                            <Edit3 size={12} className="inline mr-1" />
                            Edit
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Rule Suggestions */}
                {message.suggestedRules && message.suggestedRules.length > 0 && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-medium text-sm mb-2 text-yellow-800">💡 Suggested Rule Improvements:</h4>
                    <div className="space-y-2">
                      {message.suggestedRules.map((rule, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="flex-1 text-sm text-yellow-700">{rule}</div>
                          <button
                            onClick={() => submitRuleSuggestion(rule)}
                            className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                          >
                            Submit
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Citations */}
                {message.citations && message.citations.length > 0 && (
                  <div className="mt-3">
                    <h4 className="font-medium text-sm mb-2">Sources:</h4>
                    <div className="space-y-1">
                      {message.citations.map((citation, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
                          onClick={() => openCitation(citation.url)}
                        >
                          <ExternalLink size={14} />
                          {citation.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Script Suggestions */}
                {message.scriptSuggestions && message.scriptSuggestions.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-sm mb-2 text-blue-800">📚 Related Existing Scripts:</h4>
                    <div className="space-y-2">
                      {message.scriptSuggestions.map((script) => (
                        <div key={script.id} className="flex items-start gap-3 p-2 bg-white rounded border">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-medium text-sm text-gray-900">{script.title}</h5>
                              {script.is_featured && (
                                <span className="px-1 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">Featured</span>
                              )}
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    size={12}
                                    className={i < script.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}
                                  />
                                ))}
                                <span className="text-xs text-gray-500">({script.rating})</span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-600 mb-1">{script.description}</p>
                            <p className="text-xs text-blue-600 mb-1">by {script.author}</p>
                            <p className="text-xs text-gray-500 italic">{script.relevance_reason}</p>
                          </div>
                          <button
                            onClick={() => window.open(script.url, '_blank')}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback Buttons (AI messages only) */}
                {message.type === 'ai' && !message.feedback && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                    <span className="text-xs text-gray-500">Was this helpful?</span>
                    <button
                      onClick={() => submitFeedback(message.id, 'approved')}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                    >
                      <ThumbsUp size={12} />
                      Approve
                    </button>
                    <button
                      onClick={() => submitFeedback(message.id, 'declined')}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                    >
                      <ThumbsDown size={12} />
                      Decline
                    </button>
                    <button
                      onClick={() => copyToClipboard(message.content)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      <Copy size={12} />
                      Copy
                    </button>
                  </div>
                )}

                {/* Feedback Status */}
                {message.feedback && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">Feedback:</span>
                      <span
                        className={`px-2 py-1 rounded ${
                          message.feedback.decision === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : message.feedback.decision === 'declined'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {message.feedback.decision}
                      </span>
                      {message.feedback.rating && (
                        <span className="text-gray-500">
                          ⭐ {message.feedback.rating}/5
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                <div className="text-xs text-gray-400 mt-2">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>

              {message.type === 'user' && (
                <div className="flex-shrink-0">
                  <User className="text-blue-600 mt-1" size={20} />
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <Bot className="text-purple-600 mt-1" size={20} />
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                  <span className="text-gray-600">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about scripts..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={2}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-300 transition-colors flex items-center gap-2"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}

export default AIBotInterface
