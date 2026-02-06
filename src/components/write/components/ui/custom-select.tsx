import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
    value: string
    label: string
    icon?: string // For social icons if needed, though we might just use label
}

interface CustomSelectProps {
    value: string
    onChange: (value: string) => void
    options: SelectOption[]
    placeholder?: string
    className?: string
    disabled?: boolean
}

export function CustomSelect({ value, onChange, options, placeholder = 'Select...', className = '', disabled = false }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const selectedOption = options.find(o => o.value === value)

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`flex items-center justify-between w-full px-4 py-2 text-sm bg-base-100 border rounded-lg transition-all
                    ${isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-base-300 hover:border-primary'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                <span className={`truncate ${!selectedOption ? 'text-base-content/50' : ''}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform opacity-50 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 overflow-hidden bg-base-100 border border-base-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value)
                                setIsOpen(false)
                            }}
                            className={`w-full px-4 py-2 text-sm text-left transition-colors
                                ${option.value === value 
                                    ? 'bg-primary text-primary-content' 
                                    : 'hover:bg-primary/10 hover:text-primary text-base-content'
                                }
                            `}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
