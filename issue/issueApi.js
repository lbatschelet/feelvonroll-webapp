/**
 * API client for issue submissions.
 * Single responsibility: HTTP communication with the issues endpoint.
 *
 * Exports: createIssueApi.
 */

/**
 * @param {{ apiBase: string }} config
 */
export function createIssueApi({ apiBase }) {
  /**
   * Submit an issue to the API.
   *
   * @param {object} payload — form data + debug info
   * @returns {Promise<{ success: boolean, issue_url: string }>}
   * @throws {Error} on HTTP or network failure
   */
  async function submitIssue(payload) {
    const response = await fetch(`${apiBase}/issues.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`)
    }

    return data
  }

  return { submitIssue }
}
