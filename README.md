
# Custom Moodle UX Client ReactJS

  

This project is a Chrome extension designed to facilitate the navigation and experience of students using Moodle at the UTN T.U.V.

It provides a user-friendly interface that includes a button to inject the new react client.

  
  

![button to inject the code](https://i.imgur.com/2DDN7rl.png)
![the new ui](https://i.imgur.com/Zs6FUVm.png)

  

## Features

  

-  **SeesionKey Extraction**: A requirement to interact with the service API from the extension.

-  **HTML React Injection**: Automatically adds the new html code, enabling users to have a nicer experience.

-  **Hapiness**: by avoiding using the original moodle UI people have experimented an incrsement in hapiness

  

## Installation

  

1. Clone the repository:

```bash

git clone CustomMoodleUXClientReact

cd CustomMoodleUXClientReact

```

  

2. Install dependencies:

```bash

npm install

```

  

3. Build the project:

```bash

npm run build

```

  

4. Load the extension in Chrome:

- Open Chrome and navigate to `chrome://extensions/`.

- Enable "Developer mode".

- Click "Load unpacked" and select the `dist` folder.

  

## Usage

  

- Click on the "Inject Code" iconn button in the Chrome tab to start the magic.

- Refresh your tab to remove all the injected stuff (if you want to remove everything completely you need to uninstall the extension).

  

## Contributing

  

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

  

## License

  

This project is licensed under the MIT License. See the LICENSE file for details.