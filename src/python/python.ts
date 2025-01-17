/* eslint-disable require-atomic-updates */
import { getExecOutput } from "@actions/exec"
import assert from "assert"
import { GITHUB_ACTIONS } from "ci-info"
import { info, warning } from "ci-log"
import { execa } from "execa"
import memoize from "micro-memoize"
import { addExeExt, dirname, join } from "patha"
import which from "which"
import { addPath } from "../utils/env/addEnv"
import { hasDnf } from "../utils/env/hasDnf"
import { isArch } from "../utils/env/isArch"
import { isUbuntu } from "../utils/env/isUbuntu"
import { setupAptPack } from "../utils/setup/setupAptPack"
import { InstallationInfo } from "../utils/setup/setupBin"
import { setupBrewPack } from "../utils/setup/setupBrewPack"
import { setupChocoPack } from "../utils/setup/setupChocoPack"
import { setupDnfPack } from "../utils/setup/setupDnfPack"
import { setupPacmanPack } from "../utils/setup/setupPacmanPack"
import { isBinUptoDate } from "../utils/setup/version"
import { unique } from "../utils/std"
import { MinVersions } from "../versions/default_versions"
import { pathExists } from "path-exists"
import { hasPipx, setupPipPackSystem, setupPipPackWithPython } from "../utils/setup/setupPipPack"

export async function setupPython(version: string, setupDir: string, arch: string): Promise<InstallationInfo> {
  const installInfo = await findOrSetupPython(version, setupDir, arch)
  assert(installInfo.bin !== undefined)
  const foundPython = installInfo.bin

  // setup pip
  const foundPip = await findOrSetupPip(foundPython)
  if (foundPip === undefined) {
    throw new Error("pip was not installed correctly")
  }

  await setupPipx(foundPython)

  await setupWheel(foundPython)

  return installInfo
}

async function setupPipx(foundPython: string) {
  try {
    if (!(await hasPipx(foundPython))) {
      await setupPipPackWithPython(foundPython, "pipx", undefined, { upgrade: true, usePipx: false })
    }
    await execa(foundPython, ["-m", "pipx", "ensurepath"], { stdio: "inherit" })
    await setupPipPackWithPython(foundPython, "venv", undefined, { upgrade: false, usePipx: false })
  } catch (err) {
    warning(`Failed to install pipx: ${(err as Error).toString()}. Ignoring...`)
  }
}

/** Setup wheel and setuptools */
async function setupWheel(foundPython: string) {
  try {
    await setupPipPackWithPython(foundPython, "setuptools", undefined, {
      upgrade: true,
      isLibrary: true,
      usePipx: false,
    })
    await setupPipPackWithPython(foundPython, "wheel", undefined, { upgrade: true, isLibrary: true, usePipx: false })
  } catch (err) {
    warning(`Failed to install setuptools or wheel: ${(err as Error).toString()}. Ignoring...`)
  }
}

async function findOrSetupPython(version: string, setupDir: string, arch: string) {
  let installInfo: InstallationInfo | undefined
  let foundPython = await findPython(setupDir)

  if (foundPython !== undefined) {
    const binDir = dirname(foundPython)
    installInfo = { bin: foundPython, installDir: binDir, binDir }
  } else {
    // if python is not found, try to install it
    if (GITHUB_ACTIONS) {
      // install python in GitHub Actions
      try {
        info("Installing python in GitHub Actions")
        const { setupActionsPython } = await import("./actions_python")
        await setupActionsPython(version, setupDir, arch)

        foundPython = (await findPython(setupDir))!
        const binDir = dirname(foundPython)
        installInfo = { bin: foundPython, installDir: binDir, binDir }
      } catch (err) {
        warning((err as Error).toString())
      }
    }
    if (installInfo === undefined) {
      // install python via system package manager
      installInfo = await setupPythonSystem(setupDir, version)
    }
  }

  if (foundPython === undefined || installInfo.bin === undefined) {
    foundPython = (await findPython(setupDir))!
    installInfo.bin = foundPython
  }

  return installInfo
}

async function setupPythonSystem(setupDir: string, version: string) {
  let installInfo: InstallationInfo | undefined
  switch (process.platform) {
    case "win32": {
      if (setupDir) {
        await setupChocoPack("python3", version, [`--params=/InstallDir:${setupDir}`])
      } else {
        await setupChocoPack("python3", version)
      }
      // Adding the bin dir to the path
      const bin = (await findPython(setupDir))!
      const binDir = dirname(bin)
      /** The directory which the tool is installed to */
      await addPath(binDir)
      installInfo = { installDir: binDir, binDir, bin }
      break
    }
    case "darwin": {
      installInfo = await setupBrewPack("python3", version)
      // add the python and pip binaries to the path
      const brewPythonPrefix = await execa("brew", ["--prefix", "python"], { stdio: "pipe" })
      const brewPythonBin = join(brewPythonPrefix.stdout, "libexec", "bin")
      await addPath(brewPythonBin)

      break
    }
    case "linux": {
      if (isArch()) {
        installInfo = await setupPacmanPack("python", version)
      } else if (hasDnf()) {
        installInfo = await setupDnfPack([{ name: "python3", version }])
      } else if (isUbuntu()) {
        installInfo = await setupAptPack([{ name: "python3", version }, { name: "python-is-python3" }])
      } else {
        throw new Error("Unsupported linux distributions")
      }
      break
    }
    default: {
      throw new Error("Unsupported platform")
    }
  }
  return installInfo
}

async function findPython(binDir?: string) {
  for (const pythonBin of ["python3", "python"]) {
    // eslint-disable-next-line no-await-in-loop
    const foundPython = await isPythonUpToDate(pythonBin, binDir)
    if (foundPython !== undefined) {
      return foundPython
    }
  }
  return undefined
}

async function isPythonUpToDate(candidate: string, binDir?: string) {
  try {
    if (binDir !== undefined) {
      const pythonBinPath = join(binDir, addExeExt(candidate))
      if (await pathExists(pythonBinPath)) {
        if (await isBinUptoDate(pythonBinPath, MinVersions.python!)) {
          return pythonBinPath
        }
      }
    }
    const pythonBinPaths = (await which(candidate, { nothrow: true, all: true })) ?? []
    for (const pythonBinPath of pythonBinPaths) {
      // eslint-disable-next-line no-await-in-loop
      if (await isBinUptoDate(pythonBinPath, MinVersions.python!)) {
        return pythonBinPath
      }
    }
  } catch {
    // fall through
  }
  return undefined
}

async function findOrSetupPip(foundPython: string) {
  const maybePip = await findPip()

  if (maybePip === undefined) {
    // install pip if not installed
    info("pip was not found. Installing pip")
    await setupPip(foundPython)
    return findPip() // recurse to check if pip is on PATH and up-to-date
  }

  return maybePip
}

async function findPip() {
  for (const pipCandidate of ["pip3", "pip"]) {
    // eslint-disable-next-line no-await-in-loop
    const maybePip = await isPipUptoDate(pipCandidate)
    if (maybePip !== undefined) {
      return maybePip
    }
  }
  return undefined
}

async function isPipUptoDate(pip: string) {
  try {
    const pipPaths = (await which(pip, { nothrow: true, all: true })) ?? []
    for (const pipPath of pipPaths) {
      // eslint-disable-next-line no-await-in-loop
      if (pipPath !== null && (await isBinUptoDate(pipPath, MinVersions.pip!))) {
        return pipPath
      }
    }
  } catch {
    // fall through
  }
  return undefined
}

async function setupPip(foundPython: string) {
  const upgraded = await ensurePipUpgrade(foundPython)
  if (!upgraded) {
    // ensure that pip is installed on Linux (happens when python is found but pip not installed)
    await setupPipPackSystem("pip")

    // upgrade pip
    await ensurePipUpgrade(foundPython)
  }
}

async function ensurePipUpgrade(foundPython: string) {
  try {
    await execa(foundPython, ["-m", "ensurepip", "-U", "--upgrade"], { stdio: "inherit" })
    return true
  } catch (err1) {
    info((err1 as Error)?.toString?.())
    try {
      // ensure pip is disabled on Ubuntu
      await execa(foundPython, ["-m", "pip", "install", "--upgrade", "pip"], { stdio: "inherit" })
      return true
    } catch (err2) {
      info((err2 as Error)?.toString?.())
      // pip module not found
    }
  }
  // all methods failed
  return false
}

async function addPythonBaseExecPrefix_raw(python: string) {
  const dirs: string[] = []

  // detection based on the platform
  if (process.platform === "linux") {
    dirs.push("/home/runner/.local/bin/")
  } else if (process.platform === "darwin") {
    dirs.push("/usr/local/bin/")
  }

  // detection using python.sys
  const base_exec_prefix = (await getExecOutput(`${python} -c "import sys;print(sys.base_exec_prefix);"`)).stdout.trim()
  // any of these are possible depending on the operating system!
  dirs.push(join(base_exec_prefix, "Scripts"), join(base_exec_prefix, "Scripts", "bin"), join(base_exec_prefix, "bin"))

  // remove duplicates
  return unique(dirs)
}

/**
 * Add the base exec prefix to the PATH. This is required for Conan, Meson, etc. to work properly.
 *
 * The answer is cached for subsequent calls
 */
export const addPythonBaseExecPrefix = memoize(addPythonBaseExecPrefix_raw, { isPromise: true })
