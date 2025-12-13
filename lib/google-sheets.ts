import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export async function getGoogleSheetsClient() {
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: privateKey,
    },
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
