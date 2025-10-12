/**
 * Block reference utilities for parsing and handling heading-based block IDs
 *
 * Block reference syntax: [[Note Name#heading-text]]
 * Headings automatically become blocks with slugified IDs
 */

export interface BlockReference {
  noteName: string;
  blockId: string | null;
}

/**
 * Parse a link to extract note name and optional block ID
 * Examples:
 * - "[[Note Name]]" -> { noteName: "Note Name", blockId: null }
 * - "[[Note Name#my-heading]]" -> { noteName: "Note Name", blockId: "my-heading" }
 */
export function parseBlockReference(link: string): BlockReference {
  // Remove [[ and ]] if present
  let cleaned = link.replace(/^\[\[/, '').replace(/\]\]$/, '');

  // Check for block reference marker #
  const blockRefMatch = cleaned.match(/^(.+?)#(.+)$/);

  if (blockRefMatch) {
    return {
      noteName: blockRefMatch[1].trim(),
      blockId: blockRefMatch[2].trim()
    };
  }

  return {
    noteName: cleaned.trim(),
    blockId: null
  };
}

/**
 * Check if a link contains a block reference
 */
export function hasBlockReference(link: string): boolean {
  return link.includes('#') && !link.startsWith('#');
}

/**
 * Generate a block ID (slug) from heading text
 * Example: "My Heading!" -> "my-heading"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '_') // Replace special chars with underscore
    .replace(/\s+/g, '-')       // Replace spaces with hyphens
    .replace(/-+/g, '-')        // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');     // Remove leading/trailing hyphens
}

/**
 * Check if a line is a markdown heading
 */
export function isHeading(line: string): boolean {
  return /^#{1,6}\s+.+$/.test(line);
}

/**
 * Extract heading text from a markdown heading line
 * Example: "## My Heading" -> "My Heading"
 */
export function extractHeadingText(line: string): string | null {
  const match = line.match(/^#{1,6}\s+(.+)$/);
  return match ? match[1].trim() : null;
}
