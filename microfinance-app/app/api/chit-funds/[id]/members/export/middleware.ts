import { NextRequest } from 'next/server';

export async function parseFormData(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    // If the request is JSON, parse it normally
    return await request.json();
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    // If the request is form data, parse it manually
    const formData = await request.formData();
    const memberIdsStr = formData.get('memberIds');
    
    if (memberIdsStr) {
      try {
        // Try to parse the JSON string
        const memberIds = JSON.parse(memberIdsStr.toString());
        return { memberIds };
      } catch (error) {
        // If parsing fails, try to handle it as a comma-separated string
        const memberIds = memberIdsStr.toString().split(',').map(id => parseInt(id.trim()));
        return { memberIds };
      }
    }
    
    return { memberIds: [] };
  }
  
  // Default empty response
  return { memberIds: [] };
}
