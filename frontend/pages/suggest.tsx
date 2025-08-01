import React, { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import GGMemberGuard from '@/components/GGMemberGuard'
import { useForm } from 'react-hook-form'
import { SuggestionCreate, apiService, DockmasterEntry } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import toast from 'react-hot-toast'
import { useRouter } from 'next/router'

interface SuggestionFormData {
  action: 'add' | 'remove'
  zone_id: string
  x?: number
  y?: number
  map?: number
  enabled: boolean
  reason: string
  submitter_name?: string
  submitter_discord?: string
}

interface SuggestedPrefix {
  prefix: string
  nextSuggested: string
  nearbyDockmasters: DockmasterEntry[]
  allInBookArea: DockmasterEntry[]
  closestDistance: number
  bookArea: 'N' | 'E' | 'S' | 'W' | 'XD'
  suffixes: string[]
  example: string
}

export default function SuggestPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dockmasters, setDockmasters] = useState<DockmasterEntry[]>([])
  const [pendingSuggestions, setPendingSuggestions] = useState<any[]>([])
  const [loadingDockmasters, setLoadingDockmasters] = useState(false)
  const [suggestedPrefixes, setSuggestedPrefixes] = useState<SuggestedPrefix[]>([])
  const [formStep, setFormStep] = useState<'action-coords' | 'zone-details'>('action-coords')
  const [confirmedCoords, setConfirmedCoords] = useState<{x: number, y: number} | null>(null)
  const router = useRouter()
  const { user } = useAuth()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset
  } = useForm<SuggestionFormData>({
    defaultValues: {
      action: 'add',
      enabled: true,
      map: 7
    }
  })

  // Load current Dockmasters and pending suggestions
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingDockmasters(true)
        // Load both dockmasters and pending suggestions in parallel
        const [dockmasterData, pendingData] = await Promise.all([
          apiService.getDockmasters(),
          apiService.getSuggestions('pending')
        ])
        // Filter out reference points (y=6142) and sort
        const filteredDockmasters = dockmasterData
          .filter(dm => dm.y !== 6142)
          .sort((a, b) => a.zone_id.localeCompare(b.zone_id))
        setDockmasters(filteredDockmasters)
        setPendingSuggestions(pendingData)
      } catch (error) {
        console.error('Failed to load data:', error)
        toast.error('Failed to load current data')
      } finally {
        setLoadingDockmasters(false)
      }
    }

    loadData()
  }, [])

  // Handle URL parameters to pre-populate form
  useEffect(() => {
    if (router.isReady && dockmasters.length > 0) {
      const { action, zone_id } = router.query
      
      if (action === 'remove' && typeof zone_id === 'string') {
        // Validate that the Dockmaster exists before setting it
        if (dockmasters.some(dm => dm.zone_id === zone_id)) {
          setValue('action', 'remove')
          setValue('zone_id', zone_id)
          setValue('reason', `Remove Dockmaster ${zone_id}`)
          setFormStep('zone-details') // Skip coord step for removals
        } else {
          toast.error(`Dockmaster ${zone_id} not found`)
          router.replace('/suggest?action=remove') // Remove the invalid zone_id from URL
        }
      } else if (action === 'add') {
        setValue('action', 'add')
        setFormStep('action-coords')
      }
    }
  }, [router.isReady, router.query, setValue, dockmasters])

  // Also handle the case where URL parameters are present but dockmasters haven't loaded yet
  useEffect(() => {
    if (router.isReady && dockmasters.length === 0) {
      const { action } = router.query
      
      // If it's just an add action without needing dockmaster data, we can set it immediately
      if (action === 'add') {
        setValue('action', 'add')
        setFormStep('action-coords')
      }
    }
  }, [router.isReady, router.query, setValue, dockmasters.length])

  const watchAction = watch('action')

  // When action changes to remove, skip coord step
  useEffect(() => {
    if (watchAction === 'remove') {
      setFormStep('zone-details')
      setConfirmedCoords(null)
      setSuggestedPrefixes([])
    } else if (watchAction === 'add') {
      setFormStep('action-coords')
      setConfirmedCoords(null)
      setSuggestedPrefixes([])
    }
  }, [watchAction])

  // Calculate distance between two points
  const calculateDistance = (x: number, y: number, x2: number, y2: number) => {
    return Math.sqrt(Math.pow(x2 - x, 2) + Math.pow(y2 - y, 2))
  }

  // Determine which directional book area based on coordinates
  const getBookAreaFromCoords = (x: number, y: number): 'N' | 'E' | 'S' | 'W' | 'XD' => {
    // Map boundaries: X: 0-4600, Y: 0-4000
    // Map center: approximately (2700, 2000)
    
    // XD zone area - same coordinates as backend
    if (3000 <= x && x <= 5000 && 2000 <= y && y <= 4000) {
      return 'XD'
    }
    
    // Determine cardinal direction based on map center
    const centerX = 2700
    const centerY = 2000
    
    if (y > centerY + 600) {        // y > 2600 (northern part)
      return 'N' // North
    } else if (x > centerX + 600) { // x > 3300 (eastern part)
      return 'E' // East
    } else if (y < centerY - 600) { // y < 1400 (southern part)
      return 'S' // South
    } else {                        // western part and center
      return 'W' // West
    }
  }

  // Get book area from zone ID suffix
  const getBookAreaFromZoneId = (zoneId: string): 'N' | 'E' | 'S' | 'W' | 'XD' | null => {
    // Handle XD zone IDs first
  if (zoneId.startsWith('XD')) return 'XD'
  
  const match = zoneId.match(/^(\d+[A-Z])-([NSEW])$/)
  if (!match) return null
  
  const suffix = match[2]
    
    // Cardinal directions - check if suffix ends with the direction
    if (suffix.endsWith('N') || suffix === 'N') return 'N'
    if (suffix.endsWith('E') || suffix === 'E') return 'E' 
    if (suffix.endsWith('S') || suffix === 'S') return 'S'
    if (suffix.endsWith('W') || suffix === 'W') return 'W'
    
    return null
  }

  // Suggest zone IDs based on directional book area and nearby dockmasters
  const calculateSuggestedPrefixes = useCallback(
    (x: number, y: number) => {
      if (!x || !y || dockmasters.length === 0) {
        setSuggestedPrefixes([])
        return
      }

      // Determine which book area we're in
      const targetBookArea = getBookAreaFromCoords(x, y) as 'N' | 'E' | 'S' | 'W' | 'XD'
      
      // Capture the book area type for use in closures
      const bookArea: 'N' | 'E' | 'S' | 'W' | 'XD' = targetBookArea
      
      // Special handling for XD zones
      if (targetBookArea === 'XD') {
        // For XD zones, just find the next available XD number
        const xdNums = dockmasters
          .filter(dm => dm.zone_id.startsWith('XD'))
          .map(dm => {
            const match = dm.zone_id.match(/^XD(\d+)$/)
            return match ? parseInt(match[1], 10) : 0
          })
          .filter(num => !isNaN(num) && num > 0)
        
        // Find the next available number
        let counter = 1
        while (xdNums.includes(counter)) {
          counter++
        }
        
        // Create a single suggestion for XD zone
        const xdSuggestion: SuggestedPrefix = {
          prefix: 'XD',
          nextSuggested: `XD${counter}`,
          nearbyDockmasters: dockmasters
            .filter(dm => dm.zone_id.startsWith('XD'))
            .map(dm => ({
              ...dm,
              distance: calculateDistance(x, y, dm.x, dm.y)
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5),
          allInBookArea: dockmasters.filter(dm => dm.zone_id.startsWith('XD')),
          closestDistance: dockmasters
            .filter(dm => dm.zone_id.startsWith('XD'))
            .length > 0 ? Math.min(...dockmasters
              .filter(dm => dm.zone_id.startsWith('XD'))
              .map(dm => calculateDistance(x, y, dm.x, dm.y))
            ) : 0,
          bookArea: 'XD',
          suffixes: ['XD'],
          example: `XD${counter}`
        }
        
        setSuggestedPrefixes([xdSuggestion])
        return
      }
      
      // Filter dockmasters to only those in the same book area
      const bookAreaDockmasters = dockmasters.filter(dm => {
        const dmBookArea = getBookAreaFromZoneId(dm.zone_id)
        return dmBookArea === targetBookArea
      })

      if (bookAreaDockmasters.length === 0) {
        setSuggestedPrefixes([])
        return
      }

      // Find nearby dockmasters within the book area with dynamic range
      const findNearbyDockmasters = (maxRange: number) => {
        return bookAreaDockmasters
          .map(dm => ({
            ...dm,
            distance: calculateDistance(x, y, dm.x, dm.y)
          }))
          .filter(dm => dm.distance <= maxRange)
          .sort((a, b) => a.distance - b.distance)
      }

      // Try increasingly larger ranges until we find some dockmasters
      let nearby = findNearbyDockmasters(1000)
      if (nearby.length === 0) nearby = findNearbyDockmasters(2000)
      if (nearby.length === 0) nearby = findNearbyDockmasters(3000)
      if (nearby.length === 0) nearby = findNearbyDockmasters(4000) // Max map size

      // Group by prefix within the book area
      const prefixData = new Map<string, {
        dockmasters: DockmasterEntry[],
        distances: number[],
        nextSuggested: string,
        closestDistance: number,
        allInBookArea: DockmasterEntry[]
      }>()

      nearby.forEach(dm => {
        const match = dm.zone_id.match(/^(\d+[A-Z])-([A-Z]+)$/)
        if (match) {
          const prefix = match[1]
          
          if (!prefixData.has(prefix)) {
            prefixData.set(prefix, {
              dockmasters: [],
              distances: [],
              nextSuggested: '',
              closestDistance: Infinity,
              allInBookArea: []
            })
          }
          
          const data = prefixData.get(prefix)!
          data.dockmasters.push(dm)
          data.distances.push(dm.distance)
          data.closestDistance = Math.min(data.closestDistance, dm.distance)
        }
      })

      // For each prefix, find what suffix to suggest next within the book area
      Array.from(prefixData.keys()).forEach(prefix => {
        const data = prefixData.get(prefix)!
        
        // Get all dockmasters with this prefix in the current book area
        const allWithPrefixInArea = bookAreaDockmasters.filter(dm => dm.zone_id.startsWith(prefix + '-'))
        data.allInBookArea = allWithPrefixInArea
        
        // Check the basic Zone ID and generate suggestion
        let suggestedSuffix = ''
        
        if (bookArea === 'XD') {
          suggestedSuffix = 'XD'
        } else {
          // For cardinal directions, always suggest the base direction
          suggestedSuffix = bookArea
        }
        
        let potentialZoneId = `${prefix}-${suggestedSuffix}`
        
        // Check if this Zone ID already exists in ALL dockmasters (not just book area)
        const zoneIdExists = dockmasters.some(dm => dm.zone_id === potentialZoneId)
        
        // If it exists, handle differently for cardinal directions
        if (zoneIdExists) {
          // For cardinal directions (N,S,E,W), increment the number before the direction
          const currentPrefix = prefix // e.g., "9C"
          const matches = currentPrefix.match(/^(\d+)([A-Z])$/)
          if (matches) {
            const [_, num, letter] = matches
            let newNumber = parseInt(num, 10) + 1
            
            // Keep trying new numbers until we find one that doesn't exist
            while (dockmasters.some(dm => dm.zone_id === `${newNumber}${letter}-${bookArea}`)) {
              newNumber++
            }
            
            // Update the prefix instead of the suffix
            prefix = `${newNumber}${letter}`
            // Keep the original directional suffix
            potentialZoneId = `${prefix}-${bookArea}`
          }
        }
        
        data.nextSuggested = potentialZoneId
        
        // Update nearby dockmasters to show distances
        data.dockmasters = allWithPrefixInArea
          .map(dm => ({
            ...dm,
            distance: calculateDistance(x, y, dm.x, dm.y)
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 10)
      })

      // Convert to result format, sorted by closest distance
      const result = Array.from(prefixData.entries())
        .filter(([prefix, data]) => data.nextSuggested !== '') // Only include suggestions that don't already exist
        .map(([prefix, data]) => ({
          prefix,
          nextSuggested: data.nextSuggested,
          nearbyDockmasters: data.dockmasters,
          allInBookArea: data.allInBookArea,
          closestDistance: data.closestDistance,
          bookArea: targetBookArea,
          suffixes: data.dockmasters.map(dm => {
            const match = dm.zone_id.match(/^(\d+[A-Z])-([A-Z]+)$/)
            return match ? match[2] : ''
          }).filter(Boolean),
          example: data.dockmasters[0]?.zone_id || ''
        }))
        .sort((a, b) => a.closestDistance - b.closestDistance)
        .slice(0, 3) // Show top 3 closest prefix areas

      setSuggestedPrefixes(result)
    },
    [dockmasters]
  )

  // Calculate suggestions when coordinates are confirmed
  useEffect(() => {
    if (formStep === 'zone-details' && confirmedCoords && watchAction === 'add') {
      calculateSuggestedPrefixes(confirmedCoords.x, confirmedCoords.y)
    } else {
      setSuggestedPrefixes([])
    }
  }, [formStep, confirmedCoords, watchAction, calculateSuggestedPrefixes])

  // Check if coordinates are in valid areas
  const isValidLocation = (x: number, y: number): boolean => {
    // Basic map boundaries
    if (x < 0 || x > 4600 || y < 0 || y > 4000) return false

    // Known water/unusable areas (approximate)
    const waterAreas = [
      // Central Lake
      { x1: 2200, y1: 1800, x2: 3200, y2: 2200 },
      // Add more water areas as needed
    ]

    // Check if coordinates are in water
    const inWater = waterAreas.some(area => 
      x >= area.x1 && x <= area.x2 && y >= area.y1 && y <= area.y2
    )

    return !inWater
  }

  // Handle coordinate confirmation
  const handleCoordSubmit = () => {
    const x = watch('x')
    const y = watch('y')
    
    if (!x || !y) {
      toast.error('Please enter both X and Y coordinates')
      return
    }

    const numX = Number(x)
    const numY = Number(y)

    if (!isValidLocation(numX, numY)) {
      toast.error('These coordinates appear to be in an invalid location (water or unusable area)')
      return
    }

    // Check for nearby pending suggestions
    const NEARBY_THRESHOLD = 100 // Units to check for nearby pending suggestions
    const nearbyPending = pendingSuggestions.find(suggestion => {
      if (suggestion.x && suggestion.y) {
        const distance = calculateDistance(numX, numY, suggestion.x, suggestion.y)
        return distance < NEARBY_THRESHOLD
      }
      return false
    })

    if (nearbyPending) {
      toast.error(`There is already a pending suggestion nearby (${nearbyPending.zone_id})`)
      return
    }

    setConfirmedCoords({ x: numX, y: numY })
    setFormStep('zone-details')
  }

  // Handle going back to coord entry
  const handleBackToCoords = () => {
    setFormStep('action-coords')
    setConfirmedCoords(null)
    setSuggestedPrefixes([])
    setValue('zone_id', '')
    setValue('reason', '')
  }

  const onSubmit = async (data: SuggestionFormData) => {
    try {
      setIsSubmitting(true)

      // Validate required fields for add action
      if (data.action === 'add') {
        if (!data.x || !data.y || !data.map) {
          toast.error('X, Y, and Map coordinates are required for adding a Dockmaster')
          return
        }
      } else if (data.action === 'remove') {
        // Validate that the Dockmaster still exists (hasn't been removed by another suggestion)
        if (!dockmasters.some(dm => dm.zone_id === data.zone_id)) {
          toast.error(`Dockmaster ${data.zone_id} no longer exists`)
          return
        }
        
        // Check if there's already a pending removal suggestion
        if (pendingSuggestions.some(s => s.action === 'remove' && s.zone_id === data.zone_id)) {
          toast.error(`There is already a pending removal suggestion for ${data.zone_id}`)
          return
        }
      }

      const suggestionData: SuggestionCreate = {
        action: data.action,
        zone_id: data.zone_id,
        reason: data.reason || `${data.action === 'remove' ? 'Remove' : 'Add'} Dockmaster ${data.zone_id}`,
        submitter_name: user?.username ? `${user.username}#${user.discriminator}` : data.submitter_name,
        submitter_discord: user?.discordId || data.submitter_discord,
      }

      if (data.action === 'add') {
        suggestionData.x = data.x
        suggestionData.y = data.y
      }

      await apiService.createSuggestion(suggestionData)

      toast.success('Suggestion submitted successfully!')
      reset()
      
      // Optionally redirect to home or admin panel
      setTimeout(() => {
        router.push('/')
      }, 1500)

    } catch (error) {
      console.error('Failed to submit suggestion:', error)
      toast.error('Failed to submit suggestion. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Layout title="Suggest a Change">
      <div className="max-w-6xl mx-auto">
        <GGMemberGuard>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
              <div className="mb-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Submit a Dockmaster Suggestion
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Suggest adding a new Dockmaster or removing an existing one. 
                  Your suggestion will be reviewed by admins before being applied.
                </p>
                
                {/* Info cards */}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="border border-green-200 bg-green-50 p-3 rounded-md">
                    <div className="flex">
                      <span className="text-green-600 mr-2">➕</span>
                      <div>
                        <h4 className="text-sm font-medium text-green-800">Add New Dockmaster</h4>
                        <p className="text-xs text-green-700 mt-1">
                          Suggest a new location where a Dockmaster would be useful for players
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border border-red-200 bg-red-50 p-3 rounded-md">
                    <div className="flex">
                      <span className="text-red-600 mr-2">➖</span>
                      <div>
                        <h4 className="text-sm font-medium text-red-800">Remove Existing</h4>
                        <p className="text-xs text-red-700 mt-1">
                          Suggest removing a Dockmaster that's no longer needed or useful
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Action Selection */}
              <div>
                <label className="text-base font-medium text-gray-900">Action</label>
                <p className="text-sm leading-5 text-gray-500">What would you like to do?</p>
                <fieldset className="mt-4">
                  <div className="space-y-4 sm:flex sm:items-center sm:space-y-0 sm:space-x-10">
                    <div className="flex items-center">
                      <input
                        {...register('action', { required: 'Please select an action' })}
                        id="add"
                        type="radio"
                        value="add"
                        className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300"
                      />
                      <label htmlFor="add" className="ml-3 block text-sm font-medium text-gray-700">
                        ➕ Add new Dockmaster
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        {...register('action', { required: 'Please select an action' })}
                        id="remove"
                        type="radio"
                        value="remove"
                        className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300"
                      />
                      <label htmlFor="remove" className="ml-3 block text-sm font-medium text-gray-700">
                        ➖ Remove existing Dockmaster
                      </label>
                    </div>
                  </div>
                </fieldset>
                {errors.action && (
                  <p className="mt-1 text-sm text-red-600">{errors.action.message}</p>
                )}
              </div>

              {/* Step 1: Coordinates (only for add action) */}
              {watchAction === 'add' && formStep === 'action-coords' && (
                <>
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">
                      📍 Step 1: Enter Coordinates
                    </h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Enter the X and Y coordinates where you'd like to suggest a new Dockmaster.
                    </p>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="x" className="block text-sm font-medium text-gray-700">
                          X Coordinate *
                        </label>
                        <input
                          {...register('x', { 
                            required: 'X coordinate is required',
                            min: { value: 0, message: 'X must be positive' }
                          })}
                          type="number"
                          placeholder="3499"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        />
                        {errors.x && (
                          <p className="mt-1 text-sm text-red-600">{errors.x.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="y" className="block text-sm font-medium text-gray-700">
                          Y Coordinate *
                        </label>
                        <input
                          {...register('y', { 
                            required: 'Y coordinate is required',
                            min: { value: 0, message: 'Y must be positive' }
                          })}
                          type="number"
                          placeholder="1127"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        />
                        {errors.y && (
                          <p className="mt-1 text-sm text-red-600">{errors.y.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        onClick={handleCoordSubmit}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        Next: Choose Zone ID →
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: Zone ID and Details */}
              {(formStep === 'zone-details') && (
                <>
                  {/* Confirmed coordinates display for add action */}
                  {watchAction === 'add' && confirmedCoords && (
                    <div className="border-t border-gray-200 pt-6">
                      <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-green-800">
                              📍 Coordinates Confirmed
                            </h4>
                            <p className="text-sm text-green-700 mt-1">
                              X: {confirmedCoords.x}, Y: {confirmedCoords.y}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleBackToCoords}
                            className="text-xs px-3 py-1 bg-green-200 text-green-900 rounded hover:bg-green-300 font-medium"
                          >
                            ← Change Coords
                          </button>
                        </div>
                      </div>

                      <h4 className="text-lg font-medium text-gray-900 mb-4">
                        🎯 Step 2: Choose Zone ID
                      </h4>
                    </div>
                  )}

                  {/* Zone ID */}
                  <div>
                    <label htmlFor="zone_id" className="block text-sm font-medium text-gray-700">
                      Zone ID *
                    </label>
                    
                    {watchAction === 'remove' ? (
                      // Dropdown for removal - select from existing Dockmasters
                      <div>
                        <select
                          {...register('zone_id', { 
                            required: 'Please select a Dockmaster to remove',
                          })}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                          disabled={loadingDockmasters}
                        >
                          <option value="">
                            {loadingDockmasters ? 'Loading Dockmasters...' : 'Select a Dockmaster to remove'}
                          </option>
                          {dockmasters.map((dm) => (
                            <option key={dm.zone_id} value={dm.zone_id}>
                              {dm.zone_id} - X:{dm.x}, Y:{dm.y}, Map:{dm.map} {dm.enabled ? '(Active)' : '(Inactive)'}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                          Select an existing Dockmaster from the list to suggest its removal
                        </p>
                      </div>
                    ) : (
                      // Text input for adding new Dockmaster
                      <div>
                        <input
                          {...register('zone_id', { 
                            required: 'Zone ID is required',
                            pattern: {
                              value: /^(XD\d+|\d+[A-Z]+-[NSEW])$/,
                              message: 'Zone ID format should be like "XD11" or "1A-E"'
                            }
                          })}
                          type="text"
                          placeholder="e.g., XD11, 1A-E, 2B-N, 4C-E"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Format: XD + number (e.g., XD11) or NumberLetter-Direction (e.g., 1A-E, 2B-N). Make sure this Zone ID doesn't already exist.
                        </p>
                        
                        {/* Zone ID suggestions based on coordinates */}
                        {suggestedPrefixes.length > 0 && (
                          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <div className="flex">
                              <span className="text-blue-600 mr-2">📖</span>
                              <div className="w-full">
                                <h4 className="text-sm font-medium text-blue-800">
                                  Suggested Zone IDs - {suggestedPrefixes[0]?.bookArea} Book Area
                                </h4>
                                <p className="text-xs text-blue-700 mt-1">
                                  Based on coordinates, you're in the <strong>{suggestedPrefixes[0]?.bookArea}</strong> directional book area:
                                </p>
                                <div className="mt-3 space-y-3">
                                  {suggestedPrefixes.map((suggestion) => (
                                    <div key={suggestion.prefix} className="border border-blue-300 rounded p-3 bg-blue-100">
                                      <div className="flex items-center justify-between mb-2">
                                        <div>
                                          <span className="text-sm font-bold text-blue-900">{suggestion.nextSuggested}</span>
                                          <span className="text-xs text-blue-700 ml-2">
                                            (closest: {Math.round(suggestion.closestDistance)} units away)
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setValue('zone_id', suggestion.nextSuggested)}
                                          className="text-xs px-3 py-1 bg-blue-200 text-blue-900 rounded hover:bg-blue-300 font-medium"
                                        >
                                          Use This ID
                                        </button>
                                      </div>
                                      
                                      <div className="text-xs text-blue-800 space-y-1">
                                        <div>
                                          <span className="font-medium">
                                            Nearby {suggestion.prefix}- Dockmasters ({suggestion.bookArea} area):
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                          {suggestion.nearbyDockmasters.slice(0, 6).map((dm) => (
                                            <div key={dm.zone_id} className="flex justify-between text-xs">
                                              <span className="font-mono">{dm.zone_id}</span>
                                              <span className="text-blue-600">
                                                {Math.round(calculateDistance(confirmedCoords?.x || 0, confirmedCoords?.y || 0, dm.x, dm.y))}u
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                        {suggestion.nearbyDockmasters.length > 6 && (
                                          <div className="text-xs text-blue-600 italic">
                                            ...and {suggestion.nearbyDockmasters.length - 6} more (see sidebar →)
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {errors.zone_id && (
                      <p className="mt-1 text-sm text-red-600">{errors.zone_id.message}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                      Description <span className="text-gray-500">(optional)</span>
                    </label>
                    <textarea
                      {...register('reason')}
                      rows={3}
                      placeholder={
                        watchAction === 'add' 
                          ? "Explain why this new Dockmaster location is needed (e.g., high traffic area, convenient for players, etc.)"
                          : "Explain why this Dockmaster should be removed (e.g., low usage, better alternatives nearby, etc.)"
                      }
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {watchAction === 'add' 
                        ? "Provide details about why this location would be beneficial for players"
                        : "Explain the reasoning for removing this Dockmaster"
                      }
                    </p>
                    {errors.reason && (
                      <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => router.push('/')}
                      className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? '⏳ Submitting...' : '✨ Submit Suggestion'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Sidebar - List of ALL Dockmasters in Current Book Area */}
      {suggestedPrefixes.length > 0 && formStep === 'zone-details' && watchAction === 'add' && confirmedCoords && (
        <div className="lg:col-span-1">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                📖 All {suggestedPrefixes[0]?.bookArea} Book Dockmasters
              </h3>
              
              {(() => {
                // Get all dockmasters in the current book area
                const currentBookArea = suggestedPrefixes[0]?.bookArea
                const allBookAreaDockmasters = dockmasters.filter(dm => {
                  const dmBookArea = getBookAreaFromZoneId(dm.zone_id)
                  return dmBookArea === currentBookArea
                })
                
                return (
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    <p className="text-sm text-gray-600 mb-3">
                      Total: {allBookAreaDockmasters.length} Dockmasters
                    </p>
                    {allBookAreaDockmasters
                      .sort((a, b) => a.zone_id.localeCompare(b.zone_id))
                      .map((dm) => (
                      <div 
                        key={dm.zone_id}
                        className="flex justify-between items-center text-xs p-2 border border-gray-200 rounded hover:bg-gray-50"
                      >
                        <div>
                          <span className="font-mono font-medium">{dm.zone_id}</span>
                          <div className="text-gray-500">
                            X:{dm.x}, Y:{dm.y}
                          </div>
                        </div>
                        <div className="text-right text-gray-600">
                          <div>{Math.round(calculateDistance(confirmedCoords.x, confirmedCoords.y, dm.x, dm.y))}u</div>
                          <div className={dm.enabled ? 'text-green-600' : 'text-red-600'}>
                            {dm.enabled ? '✓' : '✗'}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {allBookAreaDockmasters.length === 0 && (
                      <p className="text-sm text-gray-500 italic">
                        No Dockmasters found in {currentBookArea} book area
                      </p>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
    </GGMemberGuard>
  </div>
</Layout>
  )
}
