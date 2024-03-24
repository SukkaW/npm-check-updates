import { isEmpty, isEqual, pickBy } from 'lodash-es'
import { satisfies } from 'semver'
import { parse, parseRange } from 'semver-utils'
import { Index } from '../types/IndexType.js'
import { Options } from '../types/Options.js'
import { VersionResult } from '../types/VersionResult.js'
import { VersionSpec } from '../types/VersionSpec.js'
import getPeerDependenciesFromRegistry from './getPeerDependenciesFromRegistry.js'
import keyValueBy from './keyValueBy.js'
import queryVersions from './queryVersions.js'
import upgradeDependencies from './upgradeDependencies.js'

/**
 * Returns a 3-tuple of upgradedDependencies, their latest versions and the resulting peer dependencies.
 *
 * @param currentDependencies
 * @param options
 * @returns
 */
export async function upgradePackageDefinitions(
  currentDependencies: Index<VersionSpec>,
  options: Options,
): Promise<[Index<VersionSpec>, Index<VersionResult>, Index<Index<VersionSpec>>?]> {
  const latestVersionResults = await queryVersions(currentDependencies, options)

  const latestVersions = keyValueBy(latestVersionResults, (dep, result) =>
    result?.version &&
    (!options.filterResults ||
      options.filterResults(dep, {
        currentVersion: currentDependencies[dep],
        currentVersionSemver: parseRange(currentDependencies[dep]),
        upgradedVersion: result.version,
        upgradedVersionSemver: parse(result.version),
      }))
      ? {
          [dep]: result.version,
        }
      : null,
  )

  const upgradedDependencies = upgradeDependencies(currentDependencies, latestVersions, options)

  const filteredUpgradedDependencies = pickBy(upgradedDependencies, (v, dep) => {
    return !options.jsonUpgraded || !options.minimal || !satisfies(latestVersions[dep], currentDependencies[dep])
  })

  const filteredLatestDependencies = pickBy(latestVersions, (spec, dep) => filteredUpgradedDependencies[dep])

  if (options.peer && !isEmpty(filteredUpgradedDependencies)) {
    const upgradedPeerDependencies = await getPeerDependenciesFromRegistry(filteredLatestDependencies, options)
    const peerDependencies = { ...options.peerDependencies, ...upgradedPeerDependencies }
    if (!isEqual(options.peerDependencies, peerDependencies)) {
      const [newUpgradedDependencies, newLatestVersions, newPeerDependencies] = await upgradePackageDefinitions(
        { ...currentDependencies, ...filteredUpgradedDependencies },
        { ...options, peerDependencies, loglevel: 'silent' },
      )
      return [
        { ...filteredUpgradedDependencies, ...newUpgradedDependencies },
        { ...latestVersionResults, ...newLatestVersions },
        newPeerDependencies,
      ]
    }
  }
  return [filteredUpgradedDependencies, latestVersionResults, options.peerDependencies]
}

export default upgradePackageDefinitions
