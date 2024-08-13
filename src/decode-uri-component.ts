const token = '%[a-f0-9]{2}';
const singleMatcher = new RegExp(`(${token})|([^%]+?)`, 'gi');
const multiMatcher = new RegExp(`(${token})+`, 'gi');

function decodeComponents(components: RegExpMatchArray | [], split?: number): string[] {
  let splitAt = split;

  try {
    // Try to decode the entire string first
    return [decodeURIComponent(components.join(''))];
  } catch {
    // Do nothing
  }

  if (components.length === 1) {
    return components;
  }

  splitAt = splitAt ?? 1;

  // Split the array in 2 parts
  const left = components.slice(0, splitAt) as RegExpMatchArray;
  const right = components.slice(splitAt) as RegExpMatchArray;

  return Array.prototype.concat.call(
    [],
    decodeComponents(left),
    decodeComponents(right),
  ) as string[];
}

function decode(input: string): string {
  let localInput = input;

  try {
    return decodeURIComponent(localInput);
  } catch {
    let tokens = RegExp(singleMatcher).exec(localInput) || [];

    for (let i = 1; i < tokens.length; i++) {
      localInput = decodeComponents(tokens, i).join('');

      tokens = RegExp(singleMatcher).exec(localInput) || [];
    }

    return localInput;
  }
}

function customDecodeURIComponent(input: string): string {
  let localInput = input;

  // Keep track of all the replacements and prefill the map with the `BOM`
  const replaceMap: Record<string, string> = {
    '%FE%FF': '\uFFFD\uFFFD',
    '%FF%FE': '\uFFFD\uFFFD',
  };

  let match = multiMatcher.exec(localInput);
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

    match = multiMatcher.exec(localInput);
  }

  // Add `%C2` at the end of the map to make sure it does not replace the combinator before everything else
  replaceMap['%C2'] = '\uFFFD';

  const entries = Object.keys(replaceMap);

  for (const key of entries) {
    // Replace all decoded components
    localInput = localInput.replace(new RegExp(key, 'g'), replaceMap[key]);
  }

  return localInput;
}

export default function decodeUriComponent(encodedURI: string): string {
  if (typeof encodedURI !== 'string') {
    throw new TypeError(
      `Expected \`encodedURI\` to be of type \`string\`, got \`${typeof encodedURI}\``,
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
