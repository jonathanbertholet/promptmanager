import { expandOriginPatterns } from './utils/originPatterns.js';

export async function getProviders() {
  try {
    const response = await fetch(chrome.runtime.getURL('llm_providers.json'));
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    if (!data || !Array.isArray(data.llm_providers)) {
      console.error('Error: llm_providers.json is missing the "llm_providers" array or has incorrect format.', data);
      return { patternsObject: {}, patternsArray: [] };
    }

    const patternsObject = data.llm_providers.reduce((acc, item) => {
      acc[item.name] = item.pattern;
      return acc;
    }, {});

    // COMMENT: A provider may list several comma-separated Chrome origin patterns
    const patternsArray = data.llm_providers.flatMap((item) => expandOriginPatterns(item.pattern));

    return { patternsObject, patternsArray };
  } catch (error) {
    console.error('Error loading providers:', error);
    throw error;
  }
}
