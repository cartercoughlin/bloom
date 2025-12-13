import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export async function getGoogleSheetsClient() {
  let privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  
  console.log('Client email:', clientEmail);
  console.log('Private key exists:', !!privateKey);
  
  // Try base64 decoding first, fallback to direct use
  try {
    privateKey = Buffer.from(privateKey!, 'base64').toString('utf-8');
    console.log('Using base64 decoded key');
  } catch {
    // If not base64, use as-is and handle newlines
    privateKey = privateKey?.replace(/\\n/g, '\n');
    console.log('Using direct key with newline replacement');
  }
  
  const credentials = {
    type: "service_account",
    project_id: "bloom-budget",
    private_key: privateKey,
    client_email: clientEmail,
  };
  
  console.log('Creating auth with credentials for:', credentials.client_email);
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

export async function readSheet(spreadsheetId: string, range: string) {
  const sheets = await getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return response.data.values;
}

export async function writeSheet(spreadsheetId: string, range: string, values: any[][]) {
  const sheets = await getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      values,
    },
  });
  return response.data;
}
