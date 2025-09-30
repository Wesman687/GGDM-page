import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  height?: number
  placeholder?: string
}

export default function MarkdownEditor({ 
  value, 
  onChange, 
  height = 400, 
  placeholder = "Enter markdown content..." 
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')

  return (
    <div className="border border-gray-300 rounded-md overflow-hidden">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setActiveTab('edit')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'edit'
              ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Edit
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'preview'
              ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Preview
        </button>
      </div>

      {/* Content Area */}
      <div style={{ height: `${height}px` }} className="relative">
        {activeTab === 'edit' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full h-full p-4 text-sm font-mono border-0 resize-none focus:outline-none focus:ring-0"
            style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' }}
          />
        ) : (
          <div className="h-full overflow-auto p-4 prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {value || '*No content to preview*'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
