# Building MyTube from the sources zip

The extension shares code with the MyTube app, so the sources zip is rooted at
the repository root rather than at `extension/`.

Requirements: [Bun](https://bun.sh) 1.3 or newer, on Linux, macOS or Windows.

```sh
# from the unzipped root
bun link
bun install
cd extension
bun run build:firefox
```

The built extension is written to `extension/.output/firefox-mv3/`, matching the
submitted `mytube-extension-<version>-firefox.zip`.
