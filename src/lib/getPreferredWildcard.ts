import sortBy from 'lodash/sortBy'
import { Index } from '../types/IndexType'
import { WILDCARDS } from './version-util'

/**
 *
 * @param dependencies A dependencies collection
 * @returns Returns whether the user prefers ^, ~, .*, or .x
 * (simply counts the greatest number of occurrences) or `null` if
 * given no dependencies.
 */
function getPreferredWildcard(dependencies: Index<string | null>) {
  // if there are no dependencies, return null.
  if (Object.keys(dependencies).length === 0) {
    return null
  }

  // group the dependencies by wildcard
  const groups = Object.values(dependencies).reduce<Record<string, (string | null)[]>>((acc, dep) => {
    const wildcard = WILDCARDS.find((wildcard: string) => dep && dep.includes(wildcard))
    if (wildcard !== undefined) {
      acc[wildcard] ||= []
      acc[wildcard].push(dep)
    }
    return acc
  }, {})

  const arrOfGroups = Object.entries(groups).map(([wildcard, instances]) => ({ wildcard, instances }))

  // reverse sort the groups so that the wildcard with the most appearances is at the head, then return it.
  const sorted = sortBy(arrOfGroups, wildcardObject => -wildcardObject.instances.length)

  return sorted.length > 0 ? sorted[0].wildcard : null
}

export default getPreferredWildcard
