"use client"

import { useState, useCallback, useRef, useReducer } from "react"
import type { LocationData, ProximitySettings } from "@/lib/geolocation"

interface AttendanceState {
  isCheckingIn: boolean
  isLoading: boolean
  userLocation: LocationData | null
  error: string | null
  success: string | null
  locationValidation: {
    isValid: boolean
    message: string
  }
  deviceInfo: any | null
}

type AttendanceAction =
  | { type: "SET_CHECKING_IN"; payload: boolean }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_LOCATION"; payload: LocationData | null }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_SUCCESS"; payload: string | null }
  | { type: "SET_VALIDATION"; payload: { isValid: boolean; message: string } }
  | { type: "SET_DEVICE_INFO"; payload: any }
  | { type: "RESET_MESSAGES" }

const initialState: AttendanceState = {
  isCheckingIn: false,
  isLoading: false,
  userLocation: null,
  error: null,
  success: null,
  locationValidation: { isValid: false, message: "" },
  deviceInfo: null,
}

function attendanceReducer(state: AttendanceState, action: AttendanceAction): AttendanceState {
  switch (action.type) {
    case "SET_CHECKING_IN":
      return { ...state, isCheckingIn: action.payload }
    case "SET_LOADING":
      return { ...state, isLoading: action.payload }
    case "SET_LOCATION":
      return { ...state, userLocation: action.payload }
    case "SET_ERROR":
      return { ...state, error: action.payload }
    case "SET_SUCCESS":
      return { ...state, success: action.payload }
    case "SET_VALIDATION":
      return { ...state, locationValidation: action.payload }
    case "SET_DEVICE_INFO":
      return { ...state, deviceInfo: action.payload }
    case "RESET_MESSAGES":
      return { ...state, error: null, success: null }
    default:
      return state
  }
}

export function useAttendanceState() {
  const [state, dispatch] = useReducer(attendanceReducer, initialState)
  const locationCacheRef = useRef<{ data: LocationData; timestamp: number } | null>(null)

  const setCheckingIn = useCallback((value: boolean) => {
    dispatch({ type: "SET_CHECKING_IN", payload: value })
  }, [])

  const setLoading = useCallback((value: boolean) => {
    dispatch({ type: "SET_LOADING", payload: value })
  }, [])

  const setLocation = useCallback((location: LocationData | null) => {
    locationCacheRef.current = location ? { data: location, timestamp: Date.now() } : null
    dispatch({ type: "SET_LOCATION", payload: location })
  }, [])

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", payload: error })
  }, [])

  const setSuccess = useCallback((success: string | null) => {
    dispatch({ type: "SET_SUCCESS", payload: success })
  }, [])

  const setValidation = useCallback((isValid: boolean, message: string) => {
    dispatch({ type: "SET_VALIDATION", payload: { isValid, message } })
  }, [])

  const setDeviceInfo = useCallback((info: any) => {
    dispatch({ type: "SET_DEVICE_INFO", payload: info })
  }, [])

  const resetMessages = useCallback(() => {
    dispatch({ type: "RESET_MESSAGES" })
  }, [])

  const getCachedLocation = useCallback(() => {
    // Cache location for 10 seconds
    if (locationCacheRef.current && Date.now() - locationCacheRef.current.timestamp < 10000) {
      return locationCacheRef.current.data
    }
    return null
  }, [])

  return {
    state,
    setCheckingIn,
    setLoading,
    setLocation,
    setError,
    setSuccess,
    setValidation,
    setDeviceInfo,
    resetMessages,
    getCachedLocation,
  }
}
