export async function getProviders() {
  try {
    const response = await fetch(browser.runtime.getURL('llm_providers.json'));
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Ensure data.llm_providers is an array before proceeding
    if (!data || !Array.isArray(data.llm_providers)) {
        console.error('Error: llm_providers.json is missing the "llm_providers" array or has incorrect format.', data);
        // Return default empty values or throw a more specific error
        return { patternsObject: {}, patternsArray: [] }; 
        // Or: throw new Error('Invalid format: "llm_providers" array not found in llm_providers.json');
    }
    
    // Extract patterns as an object and an array
    // Use data.llm_providers instead of data.patterns
    const patternsObject = data.llm_providers.reduce((acc, item) => {
      // Assuming you want to map the provider name to its pattern
      acc[item.name] = item.pattern; 
      return acc;
    }, {});
    
    // Use data.llm_providers instead of data.patterns
    // Extract just the pattern strings into an array
    const patternsArray = data.llm_providers.map(item => item.pattern);
    
    return { patternsObject, patternsArray };
  } catch (error) {
    console.error('Error loading providers:', error);
    // Re-throw the error or return default values if preferred
    throw error; 
    // Or: return { patternsObject: {}, patternsArray: [] };
  }
}
