# Cockpit

An intuitive and customizable cross-platform ground control station for remote vehicles of all types.

# Development

Cockpit is typically installed as an Electron application or BlueOS Extension, but for development purposes it is valuable to run it locally. To do so, you can install the dependencies with:

```
bun install
```

and then run the server locally with:

```
bun run dev --host
```

Then you should see a prompt with the local IP and port that can be accessed through a browser, such as `localhost:5173`.