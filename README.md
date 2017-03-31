# Important!!!!
If you are upgrading from 0.0.3 please reinstall angular-cli first

# electron-angular-toolkit

## About
This package provides a command line tool, which is supposed to make the development of electron applications with angular2 as simple as possible.

This package was tested with @angular/cli@1.0.0-rc.1
## Usage

### Create the app

Create a new project with the angular-cli and navigate to the created folder:
```
ng new myapp
cd myapp
```
Install angular-electron-toolkit
```
npm install electron-angular-toolkit --save-dev
```
Run the prepare command, this will install some packages, modify the fieles: package.json, angular-cli.json, src/index.html and it will create an entry point(src/electron-main.js)
```
node_modules/.bin/electron-angular-toolkit prepare
```
### Using the node/electron api
Using the node/electron api is quite easy, simply import the package you want to use, the electron-angular-toolkit provides a webpack-config which prevents webpack from trying to bundle those native modules
```
import * as os from 'os';
import * as electron from 'electron';
import { Component } from '@angular/core';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = `app works on ${os.platform()} with electron ${electron.remote.process.versions.electron}!`;
}
```
### Run the application
The command
```
node_modules/.bin/electron-angular-toolkit build
```
will use the ng build command to bundle the application with webpack. A new bundle will be created each time you'll change your sourcecode.
Now you can use
```
electron .
```
to launch the application.
Using the build command with the `-w` option, will create a new build each time your sourcecode changes.
### Publish the application
The command
```
node_modules/.bin/electron-angular-toolkit publish
```
will create a dist folder inside your project, which will contain the stand-alone-application and a setup file.
Before publishing it is required to set the following fields in your package.json:
* description
* author
* appId (is not required but should be used otherwise it will be "com.electron.{appname}")
To get a build for a specific platform user -w (Windows), -l (Linux), -m (Mac)

### Native modules
Some modules have to run in the node js process, to prevent them from getting bundled into the webpack bundle you can add them to your package.json:
```
{
 ...,
 "nativeModules": [
    "decompress"
  ],
  ....
}
