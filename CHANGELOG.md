# Changelog

## [1.4.3](https://github.com/exile-watch/voidstone/compare/v1.4.2...v1.4.3) (2025-05-31)


### Bug Fixes

* streamline changelog generation and improve formatting ([e09b571](https://github.com/exile-watch/voidstone/commit/e09b5711eb9e752d904e280d7fe66a2a435e9004))

## [1.4.2](https://github.com/exile-watch/voidstone/compare/v1.4.1...v1.4.2) (2025-05-25)


### Bug Fixes

* validate callback in transform function and improve error handling ([56f007a](https://github.com/exile-watch/voidstone/commit/56f007a3414d191d89e3986bb93b65bbb28b440c))

## [1.4.1](https://github.com/exile-watch/voidstone/compare/v1.4.0...v1.4.1) (2025-05-25)


### Bug Fixes

* improve formatting of warning message for unpublish failure ([6f0bccd](https://github.com/exile-watch/voidstone/commit/6f0bccdb8a075822fb263d383606fbbd195663fa))

## [1.4.0](https://github.com/exile-watch/voidstone/compare/v1.3.0...v1.4.0) (2025-05-25)


### Features

* enhance changelog transformation to handle edge cases ([3458efa](https://github.com/exile-watch/voidstone/commit/3458efa36a414673ad16a8c941db378a57699dc6))

## [1.3.0](https://github.com/exile-watch/voidstone/compare/v1.2.3...v1.3.0) (2025-05-25)


### Features

* add filtering for [skip ci] commits in changelog generation ([191e170](https://github.com/exile-watch/voidstone/commit/191e1708adf01a4510a47b53b99d45bc46a037e6))


### Bug Fixes

* format ([c264a9f](https://github.com/exile-watch/voidstone/commit/c264a9f51d5b8a1116e727dfdef0e45414a94fd2))
* remove date line from changelog when creating GitHub release ([162bd08](https://github.com/exile-watch/voidstone/commit/162bd08e86c77c175e192121dba95bbe67c36b95))

## [1.2.3](https://github.com/exile-watch/voidstone/compare/v1.2.2...v1.2.3) (2025-05-11)


### Bug Fixes

* lint ([f77b8b4](https://github.com/exile-watch/voidstone/commit/f77b8b4ed39cbc29a56033c9b61bdf6c2e8f2a37))
* update syncLockfile tests for improved accuracy and error handling ([9ab1038](https://github.com/exile-watch/voidstone/commit/9ab1038d99ca12a4ba64e7ca41f010e879bf321a))

## [1.2.2](https://github.com/exile-watch/voidstone/compare/v1.2.1...v1.2.2) (2025-05-10)


### Bug Fixes

* update syncLockfile to be synchronous and include git push after commit ([268f9df](https://github.com/exile-watch/voidstone/commit/268f9df984c4c75e83a4b4f7ec8f267c3709515e))

## [1.2.1](https://github.com/exile-watch/voidstone/compare/v1.2.0...v1.2.1) (2025-05-10)


### Bug Fixes

* refactor syncLockfile to handle commits based on package-lock.json changes ([cf6f17c](https://github.com/exile-watch/voidstone/commit/cf6f17c9510ec7b2da9fe42eb132967c8273b2a2))

## [1.2.0](https://github.com/exile-watch/voidstone/compare/v1.1.5...v1.2.0) (2025-05-02)


### Features

* add syncLockfile step to manage package-lock.json updates ([18b9a12](https://github.com/exile-watch/voidstone/commit/18b9a1200c69d52aeca1d01d7bba047d2652f2f8))

## [1.1.5](https://github.com/exile-watch/voidstone/compare/v1.1.4...v1.1.5) (2025-05-02)


### Bug Fixes

* add git fetch command to update changelogs process ([5a6e854](https://github.com/exile-watch/voidstone/commit/5a6e854f1245aba3116d455d6851da12ced938a3))

## [1.1.4](https://github.com/exile-watch/voidstone/compare/v1.1.3...v1.1.4) (2025-05-02)


### Bug Fixes

* surely this will fix changelogs not being generated ([583d5ca](https://github.com/exile-watch/voidstone/commit/583d5cafccb4ffb08382507e4ca7ee53fd051351))

## [1.1.3](https://github.com/exile-watch/voidstone/compare/v1.1.2...v1.1.3) (2025-05-01)


### Bug Fixes

* add schema reference to biome configuration ([7bb7bf7](https://github.com/exile-watch/voidstone/commit/7bb7bf77312b552bf6fbc9f199b284965913498f))

## [1.1.2](https://github.com/exile-watch/voidstone/compare/v1.1.1...v1.1.2) (2025-05-01)


### Bug Fixes

* update @exile-watch/biome-config to version 1.3.0 ([2aeb678](https://github.com/exile-watch/voidstone/commit/2aeb6785884c4bd5c7d6d5955f9a75cb951f1b57))

## [1.1.1](https://github.com/exile-watch/voidstone/compare/v1.1.0...v1.1.1) (2025-05-01)


### Bug Fixes

* update updateChangelogs changelog generation ([687fac4](https://github.com/exile-watch/voidstone/commit/687fac478084d3bcadb076a87f70b0669f9ac59f))

## [1.1.0](https://github.com/exile-watch/voidstone/compare/v1.0.27...v1.1.0) (2025-05-01)


### Features

* add code quality assurance workflow and remove pull request trigger from publish-package.yml ([60536f8](https://github.com/exile-watch/voidstone/commit/60536f8d6232b5d771f2ddb9b2e3f6d99c8a7221))
* integrate code quality assurance into publish-package workflow ([140ac66](https://github.com/exile-watch/voidstone/commit/140ac66c07511b805e267616bbab0ad2b99a571d))
* restructure main function and add missing tests to the steps ([6497d38](https://github.com/exile-watch/voidstone/commit/6497d386a208b55986099324125632adbec89f68))


### Bug Fixes

* update GitHub token reference to use secrets in code-quality-assurance.yml ([6ceccfb](https://github.com/exile-watch/voidstone/commit/6ceccfbee41272d30b17c000de6b5b3ba7e71df0))

## [1.0.27](https://github.com/exile-watch/voidstone/compare/v1.0.26...v1.0.27) (2025-04-27)


### Bug Fixes

* enhance changelog generation and improve package path handling ([a198ebb](https://github.com/exile-watch/voidstone/commit/a198ebb1d1886498dbde9936c37637993e88007f))

## [1.0.26](https://github.com/exile-watch/voidstone/compare/v1.0.25...v1.0.26) (2025-04-27)


### Bug Fixes

* improve rollback process for releases and enhance error handling ([2ce292c](https://github.com/exile-watch/voidstone/commit/2ce292cb73c74e9712425c90df7443556804186a))

## [1.0.25](https://github.com/exile-watch/voidstone/compare/v1.0.24...v1.0.25) (2025-04-27)


### Bug Fixes

* refine version bump calculations and enhance release process ([6472168](https://github.com/exile-watch/voidstone/commit/6472168a57eef4d9b928c1eeb3cfc4249fbb1a94))

## [1.0.24](https://github.com/exile-watch/voidstone/compare/v1.0.23...v1.0.24) (2025-04-27)


### Bug Fixes

* update NODE_AUTH_TOKEN to use GH_TOKEN for npm publish ([481df62](https://github.com/exile-watch/voidstone/commit/481df620a62fdc4994a26fdf7e2f3f0a340ca248))

## [1.0.23](https://github.com/exile-watch/voidstone/compare/v1.0.22...v1.0.23) (2025-04-27)


### Bug Fixes

* update NODE_AUTH_TOKEN to use GH_TOKEN for package installation ([db2d76e](https://github.com/exile-watch/voidstone/commit/db2d76e34bd75deda0779359851c2494c59c2879))

## [1.0.22](https://github.com/exile-watch/voidstone/compare/v1.0.21...v1.0.22) (2025-04-27)


### Bug Fixes

* enhance logging for Git commands and streamline execution process ([589366a](https://github.com/exile-watch/voidstone/commit/589366ab6f7632ffa02bf0301548547a7c396e95))

## [1.0.21](https://github.com/exile-watch/voidstone/compare/v1.0.20...v1.0.21) (2025-04-27)


### Bug Fixes

* remove redundant Git setup from the script ([a850604](https://github.com/exile-watch/voidstone/commit/a8506047f15c8fc127023f1ddda383e1b42b86a9))
* remove unnecessary GH_ACTOR input from GitHub action ([7f9d51b](https://github.com/exile-watch/voidstone/commit/7f9d51bf63e0227c2bc88f1fc412f6b38a6e86ad))

## [1.0.20](https://github.com/exile-watch/voidstone/compare/v1.0.19...v1.0.20) (2025-04-27)


### Bug Fixes

* enhance rollback functionality to revert releases and reopen PRs ([bcd453e](https://github.com/exile-watch/voidstone/commit/bcd453ecf7f7569c761c80f44fc2bfcfb0bf2e9d))

## [1.0.19](https://github.com/exile-watch/voidstone/compare/v1.0.18...v1.0.19) (2025-04-27)


### Bug Fixes

* move Git setup to the appropriate location in the script ([1787720](https://github.com/exile-watch/voidstone/commit/1787720fc068affd81f5eee3af9c16f1dc5682fe))

## [1.0.18](https://github.com/exile-watch/voidstone/compare/v1.0.17...v1.0.18) (2025-04-27)


### Bug Fixes

* implement dependency update commits and enhance package bump logic ([8905aa5](https://github.com/exile-watch/voidstone/commit/8905aa5e246510dd0421d66bff4df106789ed721))

## [1.0.17](https://github.com/exile-watch/voidstone/compare/v1.0.16...v1.0.17) (2025-04-27)


### Bug Fixes

* update changelog generation to include full history and latest changes ([f949328](https://github.com/exile-watch/voidstone/commit/f94932855a7c75a527eb920fe78e303e5f46cb1b))

## [1.0.16](https://github.com/exile-watch/voidstone/compare/v1.0.15...v1.0.16) (2025-04-27)


### Bug Fixes

* enhance release process with dependency updates and streamlined commits ([f73287e](https://github.com/exile-watch/voidstone/commit/f73287e84e2c3e6c3d332548c415c5081ffd9ae7))

## [1.0.15](https://github.com/exile-watch/voidstone/compare/v1.0.14...v1.0.15) (2025-04-27)


### Bug Fixes

* update tag format in rollback and release functions for consistency ([5b6c7aa](https://github.com/exile-watch/voidstone/commit/5b6c7aaaef0274986945633e057f4cb6b23539b5))

## [1.0.14](https://github.com/exile-watch/voidstone/compare/v1.0.13...v1.0.14) (2025-04-27)


### Bug Fixes

* implement custom bumping logic to enhance version determination based on commit types ([50dcee1](https://github.com/exile-watch/voidstone/commit/50dcee1791877a90244ae8b94c35693c9fbb7e57))

## [1.0.13](https://github.com/exile-watch/voidstone/compare/v1.0.12...v1.0.13) (2025-04-27)


### Bug Fixes

* update tag configuration to use object format for better clarity ([567e18b](https://github.com/exile-watch/voidstone/commit/567e18bec32b8cff41e5bedaea71945b7f403a0d))

## [1.0.12](https://github.com/exile-watch/voidstone/compare/v1.0.11...v1.0.12) (2025-04-27)


### Bug Fixes

* improve package version bumping logic and streamline release process ([6239cf3](https://github.com/exile-watch/voidstone/commit/6239cf351db31119b5c8092632952e0c6c45a827))

## [1.0.11](https://github.com/exile-watch/voidstone/compare/v1.0.10...v1.0.11) (2025-04-26)


### Bug Fixes

* enhance workspace package path resolution and improve release process ([ec2fc95](https://github.com/exile-watch/voidstone/commit/ec2fc95f7acf77a1704085d625f253943b1c7e4b))

## [1.0.10](https://github.com/exile-watch/voidstone/compare/v1.0.9...v1.0.10) (2025-04-26)


### Bug Fixes

* improve error handling by specifying error type in catch block ([7a55429](https://github.com/exile-watch/voidstone/commit/7a5542952f62cb04ccffec7d11678f6d55fdada8))

## [1.0.9](https://github.com/exile-watch/voidstone/compare/v1.0.8...v1.0.9) (2025-04-26)


### Bug Fixes

* enhance workspace package path resolution and improve error handling ([c6df900](https://github.com/exile-watch/voidstone/commit/c6df900a9192e7dc7c0af643980f79dc59419cca))

## [1.0.8](https://github.com/exile-watch/voidstone/compare/v1.0.7...v1.0.8) (2025-04-26)


### Bug Fixes

* streamline npm registry configuration and improve error handling for GH_TOKEN ([f7e7274](https://github.com/exile-watch/voidstone/commit/f7e72741b77b0f5690f5604fadf6185905c33f8f))

## [1.0.7](https://github.com/exile-watch/voidstone/compare/v1.0.6...v1.0.7) (2025-04-26)


### Bug Fixes

* add build step before npm publish in publish-package.yml ([459d1b5](https://github.com/exile-watch/voidstone/commit/459d1b500ae5b04cf6edbe68403ecf401b795480))

## [1.0.6](https://github.com/exile-watch/voidstone/compare/v1.0.5...v1.0.6) (2025-04-26)


### Bug Fixes

* streamline authentication steps in publish-package.yml ([022d374](https://github.com/exile-watch/voidstone/commit/022d374267c3deebe392c6ea8f6a9159ff87371f))

## [1.0.5](https://github.com/exile-watch/voidstone/compare/v1.0.4...v1.0.5) (2025-04-26)


### Bug Fixes

* add NODE_AUTH_TOKEN environment variable for npm publish step in publish-package.yml ([9abdfe9](https://github.com/exile-watch/voidstone/commit/9abdfe9b197247bbd19c71a251b30a433c62b4fc))

## [1.0.4](https://github.com/exile-watch/voidstone/compare/v1.0.3...v1.0.4) (2025-04-26)


### Bug Fixes

* sync lock ([2af73d4](https://github.com/exile-watch/voidstone/commit/2af73d4fa613289c7b0998e6d8b46b4d0c1ccdb6))
* update authentication parameters in publish-package.yml ([230cf2a](https://github.com/exile-watch/voidstone/commit/230cf2a6a20b10adaf8bfddc4c01cbd3db250cbc))

## [1.0.3](https://github.com/exile-watch/voidstone/compare/v1.0.2...v1.0.3) (2025-04-26)


### Bug Fixes

* remove checkout step from publish-package.yml ([6d38ac9](https://github.com/exile-watch/voidstone/commit/6d38ac9093e7812504ae84f558fb2e1bed8d9ac0))

## [1.0.2](https://github.com/exile-watch/voidstone/compare/v1.0.1...v1.0.2) (2025-04-26)


### Bug Fixes

* add GitHub Packages registry configuration to package.json ([167b60b](https://github.com/exile-watch/voidstone/commit/167b60ba31154391d2c43b02290a0d4446782134))
* update package name to include scope for better organization ([24b26f4](https://github.com/exile-watch/voidstone/commit/24b26f4928863a4515a5105fc618ed513cf5640a))
