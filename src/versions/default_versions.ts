import { isArch } from "../utils/env/isArch"

// passing "" to a tool installed by a package manager (apt, brew, choco) will result in the default version of that package manager.
// the directly downloaded tools require a given version ("" doesn't work).

function getLLVMDefault() {
  switch (process.platform) {
    case "win32":
      return "17.0.4"
    case "linux":
      // used for non-ubuntu (Fedora, Arch)
      return "17.0.5-ubuntu-22.04"
    case "darwin":
      return "15.0.3"
    default:
      return "17.0.5"
  }
}

export const DefaultVersions: Record<string, string | undefined> = {
  llvm: getLLVMDefault(), // https://github.com/llvm/llvm-project/releases
  clangtidy: getLLVMDefault(),
  clangformat: getLLVMDefault(),
  ninja: "1.11.1", // https://github.com/ninja-build/ninja/releases
  cmake: "3.27.4", // https://github.com/Kitware/CMake/releases
  gcovr: "6.0", // https://pypi.org/project/gcovr/
  conan: "1.62.0", // https://github.com/conan-io/conan/releases
  meson: "1.2.3", // https://github.com/mesonbuild/meson/releases
  kcov: "42", // https://github.com/SimonKagstrom/kcov/releases
  task: "3.31.0", // https://github.com/go-task/task/releases
  doxygen: isArch() ? "1.9.8-1" : "1.9.8", // https://www.doxygen.nl/download.html // https://packages.ubuntu.com/search?suite=all&arch=any&searchon=names&keywords=doxygen // https://formulae.brew.sh/formula/doxygen // https://archlinux.org/packages/extra/x86_64/doxygen/
  gcc: isArch() ? "13.2.1-3" : "13", // https://github.com/brechtsanders/winlibs_mingw/releases and // https://packages.ubuntu.com/search?suite=all&arch=any&searchon=names&keywords=gcc
  //mingw: isArch() ? "12.2.0-1" : "8", // https://packages.ubuntu.com/search?suite=all&arch=any&searchon=names&keywords=mingw-w64 // https://archlinux.org/packages/extra/x86_64/mingw-w64-gcc/
}

export const MinVersions: Record<string, string | undefined> = {
  pip: "22.2.0",
  python: "3.7.9",
}

/// If an ubuntu versions is not in this map:
// - the newer ubuntu versions use the first entry (e.g. v20),
// - the older ones use ""
export const DefaultLinuxVersion: Record<string, Record<number, string> | undefined> = {
  gcc: {
    22: "13",
    20: "11",
    18: "11",
    16: "11",
    14: "11",
  },
  mingw: {
    22: "8.0.0-1",
    20: "7.0.0-2",
  },
  llvm: {
    22: "17.0.5-ubuntu-22.04",
    20: "17.0.5-ubuntu-22.04",
    18: "15.0.6-ubuntu-18.04",
    16: "15.0.6-ubuntu-18.04",
    14: "13.0.0-ubuntu-16.04",
  },
  clangtidy: {
    22: "17.0.2-ubuntu-22.04",
    20: "17.0.2-ubuntu-22.04",
    18: "15.0.6-ubuntu-18.04",
    16: "15.0.6-ubuntu-18.04",
    14: "13.0.0-ubuntu-16.04",
  },
  clangformat: {
    22: "17.0.2-ubuntu-22.04",
    20: "17.0.2-ubuntu-22.04",
    18: "15.0.6-ubuntu-18.04",
    16: "15.0.6-ubuntu-18.04",
    14: "13.0.0-ubuntu-16.04",
  },
  gcovr: {
    22: "6.0",
    20: "6.0",
    18: "5.0",
  },
  meson: {
    20: "1.0.0",
    18: "0.61.4",
  },
  nala: {
    22: "",
    21: "legacy",
    20: "legacy",
    18: "legacy",
    16: "legacy",
    14: "legacy",
  },
  kcov: {
    22: "42-binary",
    20: "40-binary", // https://github.com/SimonKagstrom/kcov/releases
    18: "40",
    16: "40",
    14: "40",
  },
}
