"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Upload, Download, FileText, Users, MapPin, Building, Globe } from "lucide-react"

interface UploadResult {
  success: number
  failed: number
  errors: Array<{ row: number; error: string; field?: string; code?: string }>
}

export function BulkUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<UploadResult | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [activeTab, setActiveTab] = useState("staff")

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setResults(null)
    setPreviewData([])

    // Parse CSV/Excel file for preview
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split("\n")
      const headers = lines[0].split(",")
      const data = lines.slice(1, 6).map((line, index) => {
        const values = line.split(",")
        const row: any = { row: index + 2 }
        headers.forEach((header, i) => {
          row[header.trim()] = values[i]?.trim() || ""
        })
        return row
      })
      setPreviewData(data.filter((row) => Object.values(row).some((val) => val)))
    }
    reader.readAsText(file)
  }

  const handleUpload = async (type: string) => {
    if (!selectedFile) return

    setUploading(true)
    setProgress(0)

    const formData = new FormData()
    formData.append("file", selectedFile)
    formData.append("type", type)

    try {
      const response = await fetch("/api/admin/bulk-upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("Upload failed")

      const result = await response.json()
      setResults(result)
      setProgress(100)
    } catch (error) {
      console.error("Upload error:", error)
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplate = (type: string) => {
    if (type === "staff") {
      // Use the new template API endpoint for staff
      const link = document.createElement("a")
      link.href = "/api/admin/bulk-upload/template"
      link.download = "qcc-staff-import-template.csv"
      link.click()
      return
    }

    // Keep existing templates for other types
    const templates = {
      departments: "name,code,description\nInformation Technology,IT,IT Department",
      locations: "name,address,latitude,longitude,radius_meters\nHead Office,Accra Ghana,5.551760,-0.211845,20",
      regions: "name,code,country\nGreater Accra,GA,Ghana",
      districts: "name,region_code,latitude,longitude\nAccra Metropolitan,GA,5.551760,-0.211845",
    }

    const content = templates[type as keyof typeof templates]
    const blob = new Blob([content], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${type}_template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Data Upload
          </CardTitle>
          <CardDescription>Upload CSV/Excel files to bulk import organizational data</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="staff" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Staff
              </TabsTrigger>
              <TabsTrigger value="departments" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Departments
              </TabsTrigger>
              <TabsTrigger value="locations" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Locations
              </TabsTrigger>
              <TabsTrigger value="regions" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Regions
              </TabsTrigger>
              <TabsTrigger value="districts" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Districts
              </TabsTrigger>
            </TabsList>

            {["staff", "departments", "locations", "regions", "districts"].map((type) => (
              <TabsContent key={type} value={type} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold capitalize">{type} Upload</h3>
                    <p className="text-sm text-muted-foreground">Upload {type} data in CSV or Excel format</p>
                    {type === "staff" && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2">Format Requirements:</h4>
                        <ul className="text-sm text-blue-800 space-y-1">
                          <li>
                            <strong>Email:</strong> Valid format (e.g., user@qccgh.com)
                          </li>
                          <li>
                            <strong>Phone:</strong> Ghana format with country code (e.g., +233241234567)
                          </li>
                          <li>
                            <strong>Employee ID:</strong> Unique alphanumeric code (e.g., EMP001, 1151908)
                          </li>
                          <li>
                            <strong>Department Code:</strong> 2-4 letter code (e.g., IT, HR, FIN, ADM)
                          </li>
                          <li>
                            <strong>Hire Date:</strong> YYYY-MM-DD format (e.g., 2024-01-15)
                          </li>
                        </ul>
                        <p className="text-xs text-blue-700 mt-2">
                          <strong>Note:</strong> Invalid formats will be auto-corrected during import. Only first_name
                          and last_name are required.
                        </p>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" onClick={() => downloadTemplate(type)} className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`file-${type}`}>Select File</Label>
                    <Input
                      id={`file-${type}`}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => handleFileSelect(e, type)}
                      className="mt-1"
                    />
                  </div>

                  {selectedFile && (
                    <Alert>
                      <FileText className="h-4 w-4" />
                      <AlertDescription>
                        Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </AlertDescription>
                    </Alert>
                  )}

                  {previewData.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Preview (First 5 rows)</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {Object.keys(previewData[0] || {})
                                .filter((key) => key !== "row")
                                .map((header) => (
                                  <TableHead key={header}>{header}</TableHead>
                                ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewData.map((row, index) => (
                              <TableRow key={index}>
                                {Object.entries(row)
                                  .filter(([key]) => key !== "row")
                                  .map(([key, value]) => (
                                    <TableCell key={key}>{value as string}</TableCell>
                                  ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Uploading...</span>
                        <span className="text-sm">{progress}%</span>
                      </div>
                      <Progress value={progress} />
                    </div>
                  )}

                  {results && (
                    <Alert>
                      <AlertDescription>
                        <div className="space-y-2">
                          <div className="flex gap-4">
                            <Badge variant="default">{results.success} Successful</Badge>
                            {results.failed > 0 && <Badge variant="destructive">{results.failed} Failed</Badge>}
                          </div>
                          {results.success > 0 && (
                            <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                              <p className="text-sm text-blue-800">
                                <strong>Note:</strong> Records with validation warnings have been imported successfully.
                                You can edit these records in the Staff Management section to correct any issues like
                                invalid emails, phone numbers, or missing department assignments.
                              </p>
                            </div>
                          )}
                          {results.errors.length > 0 && (
                            <div className="mt-2">
                              <p className="font-medium">Errors (Critical Issues Only):</p>
                              <div className="text-sm space-y-2 max-h-60 overflow-y-auto">
                                {results.errors.slice(0, 10).map((error, index) => (
                                  <div key={index} className="p-2 bg-red-50 border border-red-200 rounded">
                                    <div className="font-medium text-red-800">Row {error.row}:</div>
                                    <div className="text-red-700">{error.error}</div>
                                    {error.field && (
                                      <div className="text-xs text-red-600 mt-1">
                                        Field: <span className="font-mono">{error.field}</span>
                                      </div>
                                    )}
                                    {error.code && (
                                      <div className="text-xs text-red-600">
                                        Error Code: <span className="font-mono">{error.code}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {results.errors.length > 10 && (
                                  <div className="text-center text-sm text-muted-foreground">
                                    ... and {results.errors.length - 10} more errors
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button onClick={() => handleUpload(type)} disabled={!selectedFile || uploading} className="w-full">
                    {uploading ? "Uploading..." : `Upload ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                  </Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
