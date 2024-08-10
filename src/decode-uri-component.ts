const token = '%[a-f0-9]{2}';
const singleMatcher = new RegExp(`(${token})|([^%]+?)`, 'gi');
const multiMatcher = new RegExp(`(${token})+`, 'gi');

function decodeComponents(components: RegExpMatchArray | [], split?: number): string[] {
  try {
    // Try to decode the entire string first
    return [decodeURIComponent(components.join(''))];
  } catch {
    // Do nothing
  }

  if (components.length === 1) {
    return components;
  }

  split = split ?? 1;

  // Split the array in 2 parts
  const left = components.slice(0, split) as RegExpMatchArray;
  const right = components.slice(split) as RegExpMatchArray;

  return Array.prototype.concat.call(
    [],
    decodeComponents(left),
    decodeComponents(right),
  ) as string[];
}

function decode(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    let tokens = RegExp(singleMatcher).exec(input) || [];

    for (let i = 1; i < tokens.length; i++) {
      input = decodeComponents(tokens, i).join('');

      tokens = RegExp(singleMatcher).exec(input) || [];
    }

    return input;
  }
}

function customDecodeURIComponent(input: string): string {
  // Keep track of all the replacements and prefill the map with the `BOM`
  const replaceMap: Record<string, string> = {
    '%FE%FF': '\uFFFD\uFFFD',
    '%FF%FE': '\uFFFD\uFFFD',
  };

  let match = multiMatcher.exec(input);
  while (match) {
    try {
      // Decode as big chunks as possible
      replaceMap[match[0]] = decodeURIComponent(match[0]);
    } catch {
      const result = decode(match[0]);

      if (result !== match[0]) {
        replaceMap[match[0]] = result;
      }
    }

    match = multiMatcher.exec(input);
  }

  // Add `%C2` at the end of the map to make sure it does not replace the combinator before everything else
  replaceMap['%C2'] = '\uFFFD';

  const entries = Object.keys(replaceMap);

  for (const key of entries) {
    // Replace all decoded components
    input = input.replace(new RegExp(key, 'g'), replaceMap[key]);
  }

  return input;
}

export default function decodeUriComponent(encodedURI: string): string {
  if (typeof encodedURI !== 'string') {
    throw new TypeError(
      'Expected `encodedURI` to be of type `string`, got `' + typeof encodedURI + '`',
    );
  }

  try {
    // Try the built in decoder first
    return decodeURIComponent(encodedURI);
  } catch {
    // Fallback to a more advanced decoder
    return customDecodeURIComponent(encodedURI);
  }
}
