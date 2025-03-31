import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabaseClient';
import * as XLSX from 'xlsx';
import { parse, isValid, format } from 'date-fns';
import { nl } from 'date-fns/locale';

// Parse Dutch date format with better error handling
function parseDutchDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  try {
    // Common Dutch date formats
    const formats = [
      'd-M-yyyy',    // 14-01-1972
      'dd-MM-yyyy',  // 14-01-1972
      'd/M/yyyy',    // 14/1/1972
      'dd/MM/yyyy',  // 14/01/1972
      'd-M-yy',      // 14-01-72
      'dd-MM-yy',    // 14-01-72
      'yyyy-MM-dd'   // 1972-01-14 (ISO)
    ];

    for (const dateFormat of formats) {
      const parsedDate = parse(dateStr.trim(), dateFormat, new Date(), { locale: nl });
      if (isValid(parsedDate)) {
        return format(parsedDate, 'yyyy-MM-dd');
      }
    }

    // If no format matches, try native Date parsing as fallback
    const fallbackDate = new Date(dateStr);
    if (isValid(fallbackDate)) {
      return format(fallbackDate, 'yyyy-MM-dd');
    }

    console.warn(`Could not parse date: ${dateStr}`);
    return null;
  } catch (error) {
    console.error('Error parsing date:', error, 'Input:', dateStr);
    return null;
  }
}

// Column mapping with Dutch variations
const columnMappings = {
  first_name: ['Voornaam', 'First Name', 'FirstName', 'First', 'voornaam'],
  last_name: ['Achternaam', 'Last Name', 'LastName', 'Last', 'achternaam'],
  email: ['Email', 'E-mail', 'E-mailadres', 'EmailAddress', 'email'],
  phone: ['Telefoon', 'Phone', 'PhoneNumber', 'Tel', 'Telefoonnummer'],
  street: ['Straat', 'Straatnaam', 'Street', 'Address', 'Adres'],
  house_number: ['Huisnummer', 'Nr', 'Number', 'HouseNumber', 'House'],
  postal_code: ['Postcode', 'Zip', 'ZipCode', 'PostalCode'],
  date_of_birth: ['Geboortedatum', 'DateOfBirth', 'Birth Date', 'DOB', 'geboortedatum']
};

// Find matching column name
function findMatchingColumn(headers: string[], mappings: string[]): string | null {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  const normalizedMappings = mappings.map(m => m.toLowerCase().trim());
  
  for (const mapping of normalizedMappings) {
    const index = normalizedHeaders.indexOf(mapping);
    if (index !== -1) {
      return headers[index];
    }
  }
  return null;
}

// Process Excel data
async function processExcelData(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (rawData.length < 2) {
    throw new Error('Excel bestand moet minimaal een header rij en een data rij bevatten');
  }
  
  const headers = rawData[0] as string[];
  const columnMap = {};
  
  // Create column mapping
  Object.entries(columnMappings).forEach(([field, possibleNames]) => {
    const matchingColumn = findMatchingColumn(headers, possibleNames);
    if (matchingColumn) {
      columnMap[matchingColumn] = field;
    }
  });
  
  // Map data rows
  return rawData.slice(1).map((row, index) => {
    const mappedRow = {};
    let hasRequiredFields = false;

    headers.forEach((header, colIndex) => {
      const field = columnMap[header];
      if (field && row[colIndex] !== undefined && row[colIndex] !== null) {
        const value = row[colIndex].toString().trim();
        
        // Special handling for date_of_birth
        if (field === 'date_of_birth') {
          const parsedDate = parseDutchDate(value);
          if (parsedDate) {
            mappedRow[field] = parsedDate;
          } else {
            console.warn(`Invalid date format in row ${index + 2}: ${value}`);
          }
        } else {
          mappedRow[field] = value;
        }

        // Check for required fields
        if (field === 'first_name' || field === 'last_name') {
          hasRequiredFields = true;
        }
      }
    });

    return hasRequiredFields ? mappedRow : null;
  }).filter(row => row !== null);
}

export const post: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Geen bestand geüpload' }),
        { status: 400 }
      );
    }

    // Process Excel file
    const buffer = await file.arrayBuffer();
    const processedData = await processExcelData(buffer);

    // Process each row
    const results = {
      total: processedData.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ row: any; error: string }>
    };

    for (const row of processedData) {
      try {
        // Create customer with mapped data
        const customerData = {
          first_name: row.first_name?.trim(),
          last_name: row.last_name?.trim(),
          email: row.email?.trim(),
          phone: row.phone?.trim(),
          street: row.street?.trim(),
          house_number: row.house_number?.trim(),
          postal_code: row.postal_code?.trim(),
          date_of_birth: row.date_of_birth // Already properly formatted or null
        };

        const { error: customerError } = await supabaseAdmin
          .from('customers')
          .insert(customerData);

        if (customerError) {
          throw customerError;
        }

        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: row,
          error: error.message
        });
        console.error('Error processing row:', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results: {
          total: results.total,
          successful: results.successful,
          failed: results.failed,
          errors: results.errors
        }
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Error processing upload:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};