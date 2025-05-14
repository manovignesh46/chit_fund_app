/**
 * Utility functions for API requests with robust error handling
 */

/**
 * Safely parse a response from an API call, handling both JSON and non-JSON responses
 * @param response The fetch Response object
 * @param defaultErrorMessage The default error message to use if parsing fails
 * @returns A promise that resolves to the parsed response or rejects with an error
 */
export async function safeParseResponse(response: Response, defaultErrorMessage: string = 'An error occurred'): Promise<any> {
  // If the response is OK, parse it as JSON and return
  if (response.ok) {
    return await response.json();
  }

  // If the response is not OK, try to extract an error message
  const responseText = await response.text();
  let errorMessage = defaultErrorMessage;

  try {
    // Try to parse the response as JSON
    const errorData = JSON.parse(responseText);
    errorMessage = errorData.error || defaultErrorMessage;
  } catch (parseError) {
    // If parsing fails, it's not JSON (might be HTML)
    console.error('Error response is not valid JSON:', responseText.substring(0, 100) + '...');
    
    // Check if it's an HTML response (likely a 500 error page)
    if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
      errorMessage = 'Server error occurred. Please try again later.';
    }
  }

  // Throw an error with the extracted message
  throw new Error(errorMessage);
}

/**
 * Make a GET request to an API endpoint with proper error handling
 * @param url The URL to fetch
 * @param defaultErrorMessage The default error message to use if parsing fails
 * @returns A promise that resolves to the parsed response
 */
export async function apiGet(url: string, defaultErrorMessage: string = 'Failed to fetch data'): Promise<any> {
  const response = await fetch(url);
  return await safeParseResponse(response, defaultErrorMessage);
}

/**
 * Make a POST request to an API endpoint with proper error handling
 * @param url The URL to fetch
 * @param data The data to send in the request body
 * @param defaultErrorMessage The default error message to use if parsing fails
 * @returns A promise that resolves to the parsed response
 */
export async function apiPost(url: string, data: any, defaultErrorMessage: string = 'Failed to create data'): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  return await safeParseResponse(response, defaultErrorMessage);
}

/**
 * Make a PUT request to an API endpoint with proper error handling
 * @param url The URL to fetch
 * @param data The data to send in the request body
 * @param defaultErrorMessage The default error message to use if parsing fails
 * @returns A promise that resolves to the parsed response
 */
export async function apiPut(url: string, data: any, defaultErrorMessage: string = 'Failed to update data'): Promise<any> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  return await safeParseResponse(response, defaultErrorMessage);
}

/**
 * Make a DELETE request to an API endpoint with proper error handling
 * @param url The URL to fetch
 * @param data The data to send in the request body (optional)
 * @param defaultErrorMessage The default error message to use if parsing fails
 * @returns A promise that resolves to the parsed response
 */
export async function apiDelete(url: string, data?: any, defaultErrorMessage: string = 'Failed to delete data'): Promise<any> {
  const options: RequestInit = {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(url, options);
  return await safeParseResponse(response, defaultErrorMessage);
}
