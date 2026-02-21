/**
 * Full end-to-end test for check-in/check-out flows
 * Tests all 4 scenarios:
 * 1. Within range check-in
 * 2. Off-premises check-in
 * 3. Within range check-out
 * 4. Off-premises check-out
 */

import * as https from 'https'

const BASE_URL = 'https://atfeb2026-ekfriuqp0-ohemengappiah-gmailcoms-projects.vercel.app'

interface TestResult {
  scenario: string
  status: number
  success: boolean
  data?: any
  error?: string
  hasCountdown?: boolean
}

const results: TestResult[] = []

function makeRequest(
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path)
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }

    const req = https.request(url, options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 500,
            data: data ? JSON.parse(data) : null,
          })
        } catch (e) {
          resolve({
            status: res.statusCode || 500,
            data: data,
          })
        }
      })
    })

    req.on('error', reject)

    if (body) {
      req.write(JSON.stringify(body))
    }
    req.end()
  })
}

async function testWithinRangeCheckIn() {
  console.log('\n=== TEST 1: Within Range Check-In ===')
  try {
    const response = await makeRequest('POST', '/api/attendance/check-in', {
      latitude: -31.854696,
      longitude: 116.008160,
      accuracy: 50,
      locationId: '376bb96d-da13-4fdc-bf1a-d54a8265d060',
      locationName: 'Cocobod Archives',
    })

    const hasAttendance = response.data?.attendance
    const hasCountdown = response.data?.message?.includes('checked in') || hasAttendance
    
    results.push({
      scenario: 'Within Range Check-In',
      status: response.status,
      success: response.status === 200 && hasAttendance,
      data: response.data,
      hasCountdown: !!hasAttendance,
    })

    console.log(`Status: ${response.status}`)
    console.log(`Has Attendance Data: ${hasAttendance}`)
    console.log(`Message: ${response.data?.message}`)
  } catch (error) {
    results.push({
      scenario: 'Within Range Check-In',
      status: 0,
      success: false,
      error: String(error),
    })
    console.error('Error:', error)
  }
}

async function testOffPremisesCheckIn() {
  console.log('\n=== TEST 2: Off-Premises Check-In ===')
  try {
    const response = await makeRequest('POST', '/api/attendance/check-in-outside-request', {
      latitude: -31.854696,
      longitude: 116.008160,
      accuracy: 50,
      currentLocationName: 'Off-Site Client Meeting',
      reason: 'Client meeting with external partner',
    })

    const isApproved = response.data?.status === 'approved' || response.data?.message?.includes('approved')
    
    results.push({
      scenario: 'Off-Premises Check-In',
      status: response.status,
      success: response.status === 200 || response.status === 201,
      data: response.data,
      hasCountdown: isApproved,
    })

    console.log(`Status: ${response.status}`)
    console.log(`Request Status: ${response.data?.status}`)
    console.log(`Message: ${response.data?.message}`)
  } catch (error) {
    results.push({
      scenario: 'Off-Premises Check-In',
      status: 0,
      success: false,
      error: String(error),
    })
    console.error('Error:', error)
  }
}

async function testWithinRangeCheckOut() {
  console.log('\n=== TEST 3: Within Range Check-Out ===')
  try {
    const response = await makeRequest('POST', '/api/attendance/check-out', {
      latitude: -31.854696,
      longitude: 116.008160,
      accuracy: 50,
      locationId: '376bb96d-da13-4fdc-bf1a-d54a8265d060',
      locationName: 'Cocobod Archives',
    })

    const hasCheckOut = response.data?.attendance?.check_out_time
    
    results.push({
      scenario: 'Within Range Check-Out',
      status: response.status,
      success: response.status === 200 && hasCheckOut,
      data: response.data,
    })

    console.log(`Status: ${response.status}`)
    console.log(`Has Check-Out Time: ${hasCheckOut}`)
    console.log(`Message: ${response.data?.message}`)
  } catch (error) {
    results.push({
      scenario: 'Within Range Check-Out',
      status: 0,
      success: false,
      error: String(error),
    })
    console.error('Error:', error)
  }
}

async function testOffPremisesCheckOut() {
  console.log('\n=== TEST 4: Off-Premises Check-Out ===')
  try {
    const response = await makeRequest('POST', '/api/attendance/check-out-offpremises', {
      locationId: '376bb96d-da13-4fdc-bf1a-d54a8265d060',
      currentLocationName: 'Returning to office',
    })

    const hasCheckOut = response.data?.attendance?.check_out_time
    
    results.push({
      scenario: 'Off-Premises Check-Out',
      status: response.status,
      success: response.status === 200 && hasCheckOut,
      data: response.data,
    })

    console.log(`Status: ${response.status}`)
    console.log(`Has Check-Out Time: ${hasCheckOut}`)
    console.log(`Message: ${response.data?.message}`)
  } catch (error) {
    results.push({
      scenario: 'Off-Premises Check-Out',
      status: 0,
      success: false,
      error: String(error),
    })
    console.error('Error:', error)
  }
}

async function runAllTests() {
  console.log('Starting full check-in/check-out flow tests...')
  
  await testWithinRangeCheckIn()
  await testOffPremisesCheckIn()
  await testWithinRangeCheckOut()
  await testOffPremisesCheckOut()

  console.log('\n\n=== TEST SUMMARY ===')
  console.log(`Total Tests: ${results.length}`)
  console.log(`Passed: ${results.filter(r => r.success).length}`)
  console.log(`Failed: ${results.filter(r => !r.success).length}`)
  
  console.log('\n=== DETAILED RESULTS ===')
  results.forEach(result => {
    console.log(`\n${result.scenario}:`)
    console.log(`  Status Code: ${result.status}`)
    console.log(`  Success: ${result.success}`)
    console.log(`  Has Countdown: ${result.hasCountdown || 'N/A'}`)
    if (result.error) {
      console.log(`  Error: ${result.error}`)
    }
  })

  // Check for countdown timer presence
  const checkinsWithCountdown = results.filter(r => r.hasCountdown).length
  console.log(`\n=== COUNTDOWN TIMER RESULTS ===`)
  console.log(`Check-ins with countdown capability: ${checkinsWithCountdown}`)
}

runAllTests().catch(console.error)
