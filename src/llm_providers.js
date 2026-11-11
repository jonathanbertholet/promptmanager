import './platform.js';
import { expandOriginPatterns } from './utils/originPatterns.js';

let providersDataCache = null;
let providersDataPromise = null;
let providersCache = null;

/**
 * COMMENT: Load llm_providers.json once per service-worker lifetime.
 * @returns {Promise<{ llm_providers: Array }>}
 */
async function loadProvidersData() {
  if (providersDataCache) return providersDataCache;
  if (!providersDataPromise) {
    providersDataPromise = (async () => {
      const response = await fetch(OPMApi.runtime.getURL('llm_providers.json'));
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      providersDataCache = data;
      return data;
    })().catch((error) => {
      providersDataPromise = null;
      throw error;
    });
  }
  return providersDataPromise;
}

/**
 * @returns {Promise<Array>}
 */
export async function getProviderList() {
  try {
    const data = await loadProvidersData();
    return Array.isArray(data?.llm_providers) ? data.llm_providers : [];
  } catch (error) {
    console.error('Error loading providers:', error);
    return [];
  }
}

export async function getProviders() {
  if (providersCache) return providersCache;

  try {
    const data = await loadProvidersData();

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

    providersCache = { patternsObject, patternsArray };
    return providersCache;
  } catch (error) {
    console.error('Error loading providers:', error);
    throw error;
  }
}
