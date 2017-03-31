#!/usr/bin/env node
import { AngularCliConfig } from './angular-cli-config';
import * as electronBuilder from 'electron-builder';
import * as path from 'path';
import * as childProcess from 'child_process';
import * as console from 'console';
import * as npm from 'npm';
import * as process from 'process';
import { Package } from './package';
import { ncp } from "ncp";
import { fs } from "mz";
import * as chalk from 'chalk';
import 'core-js';
class Main {

    private static configPath = path.join(__dirname, '..', '..', '@angular', 'cli', 'models', 'webpack-configs','common.js');
    private static copyConfigPath = path.join(__dirname, '..', '..', '@angular', 'cli', 'models', 'webpack-configs','original.js');

    private static fileExists(path: string): Promise<boolean> {
        return fs.exists(path);
    }


    private static async readPackageJson(): Promise<Package> {
        console.log('reading Package.json');
        try {
            let string = await fs.readFile('package.json', 'utf-8');
            console.log(chalk.green('finished reading package.json'));
            return JSON.parse(string);
        }
        catch (ex) {
            console.log(chalk.red('failed reading package.json'))
            console.log(chalk.red(ex));
            process.exit(1);
        }

    }

    private static async writePackageJson(packageJson: Package): Promise<void> {
        console.log('updating package.json');
        try {
            await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));
            console.log(chalk.green('finished updating package.json'))
        }
        catch (ex) {
            console.log(chalk.red('failed updating Package.json'));
            console.log(chalk.red(ex));
            process.exit(1);
        }
    }


    private static runNgBuild(watch: boolean): Promise<void> {
        console.log('running ng build')
        return new Promise<void>((resolve, reject) => {
            let proc = childProcess.exec(`ng build --watch=${watch} --output-path=bundle`, { maxBuffer: 1024 * 5000 }, (error, stdout, stderror) => {
                if (error) {
                    console.log(chalk.red('ng build failed'));
                    console.log(chalk.red(`ng build --watch=${watch} --output-path=bundle`));
                    console.log(chalk.red(error.message));
                    process.exit(1);
                }
                else if (stderror) {
                    console.log(chalk.green('finished ng build'));
                    resolve();
                }
                else {
                    console.log(chalk.green('finished ng build'));
                    resolve();
                }
            });
            proc.stdout.on("data", data => {
                console.log(data);
            });
        });
    }

    private static runElectronPacker(): Promise<string[]> {
        console.log("running electron-builder build");
        let targets = undefined;
        try {
            if (process.argv.indexOf('-w') > -1) {
                targets = electronBuilder.Platform.WINDOWS.createTarget();
            }
            else if (process.argv.indexOf('-l') > -1) {
                targets = electronBuilder.Platform.LINUX.createTarget();
            }
            else if (process.argv.indexOf('-m') > -1) {
                targets = electronBuilder.Platform.MAC.createTarget();
            }
            let result = electronBuilder.build({ targets: targets });
            console.log(chalk.green('finished electron-builder build'));
            return result;
        }
        catch (error) {
            console.log(chalk.red('electron-builder build failed'));
            console.log(chalk.red(error));
            process.exit(1);
        }

    }

    private static npmInstall(packages: string[], dev: boolean): Promise<void> {
        console.log('running npm install');
        let options = dev ? { 'save-dev': true } : { 'save': true };
        return new Promise<void>((resolve, reject) => {
            npm.load(options, (error) => {
                npm.commands.install(packages, (error, data) => {
                    if (error) {
                        console.log(chalk.red('npm install failed'));
                        console.log(chalk.red(`packages: ${packages.join(', ')}`));
                        console.log(error);
                        process.exit(1);
                    }
                    else {
                        console.log(chalk.green('finished npm install'));
                        resolve();
                    }
                });
            });
        });
    }

    private static async installRequiredPackages(): Promise<void> {
        console.log('installing required packages');
        try {
            await this.npmInstall(['electron', '@types/node', '@types/electron'], true);
            console.log(chalk.green('finished installing required packages'));
        }
        catch (error) {
            console.log(chalk.red('installing required packages failed'));
            console.log(chalk.red(error));
            process.exit(1);
        }

    }

    private static async preparePacageJson(): Promise<void> {
        console.log('preparing package.json');
        let packageJson: Package = await this.readPackageJson();
        packageJson.main = 'bundle/electron.js';
        packageJson.build = {
            files: ['bundle/**/*']
        }
        catch (error) {
            console.log(chalk.red('failed preparing package.json'));
            console.log(chalk.red(error));
            process.exit(1);
        }

    }

    private static async prepareIndexHtml(): Promise<void> {
        console.log('preparing index.html');
        try {
            let indexHtmlPath = path.join('src', 'index.html');
            let indexHtml = await fs.readFile(indexHtmlPath, 'utf-8');
            let updatedIndexHtml = indexHtml.replace('<base href="/">', '<base href="./">');
            let updatedIndexHtmlAssets = indexHtml.replace('"assets/">', path.join(__dirname, 'assets/'));
            await fs.writeFile(indexHtmlPath, updatedIndexHtml, updatedIndexHtmlAssets);
            console.log(chalk.green('finished preparing index.html'));
        }
        catch (error) {
            console.log(chalk.red('failed preparing index.html'));
            console.log(chalk.red(error));
            process.exit(1);
        }
    }

    private static async prepareAngularCliConfig(): Promise<void> {
        console.log('preparing angular-cli.json');
        let angularCliConfig: AngularCliConfig = JSON.parse(await fs.readFile('.angular-cli.json','utf-8'));
        if (!angularCliConfig.apps[0].assets) {
            angularCliConfig.apps[0].assets = [];
        }
        var electronAsset = {glob: "**/*", input: "./electron/", output: "./"};
        angularCliConfig.apps[0].assets.push(electronAsset);
        angularCliConfig.apps[0].outDir = "bundle";
        await fs.writeFile('.angular-cli.json', JSON.stringify(angularCliConfig, null, 2));
    }

    private static async createElectronEntryPoint(): Promise<void> {
        console.log('creating entry point');
        var targetDir = path.join('src', 'electron');
        if (!fs.existsSync(targetDir)){
            fs.mkdirSync(targetDir);
        }
        let sourcePath = path.join(__dirname, '..', 'res', 'electron-main.js.template');
        let targetPath = path.join(targetDir, 'electron.js');
        let template = await fs.readFile(sourcePath, 'utf-8');
        await fs.writeFile(targetPath, template);
    }

    private static async modifyWebpackConfig(packageJson: Package): Promise<void> {
        console.log('modifying webpack config');
        try {
            let originalConfig = await fs.readFile(this.copyConfigPath, 'utf-8');
            let nativeDependencies = ['fs', 'child_process', 'electron', 'path', 'assert', 'cluster', 'crypto', 'dns', 'domain', 'events', 'http', 'https', 'net', 'os', 'process', 'punycode',
                'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'tls', 'tty', 'dgram', 'url', 'util', 'v8', 'vm', 'zlib'];
            if (packageJson.nativeModules) {
                nativeDependencies = nativeDependencies.concat(packageJson.nativeModules);
            }
            let externalsTemplate = await fs.readFile(path.join(__dirname, '..', 'res', 'externals.template'), 'utf-8');
            let externals = externalsTemplate.replace('{ignores}', JSON.stringify(nativeDependencies));
            let newConfig = originalConfig.replace(/return ?{/g, `return {\n${externals}`);
            await fs.writeFile(this.configPath, newConfig);
            console.log(chalk.green('finished modifying webpack config'));
        }
        catch (error) {
            console.log(chalk.red('failed modifying webpack config'));
            console.log(chalk.red(error));
            process.exit(1);
        }
    }

    private static async copyWebpackConfig(): Promise<void> {
        console.log('copying webpack config');
        try {
            let configContent = await fs.readFile(this.configPath, 'utf-8');
            await fs.writeFile(this.copyConfigPath, configContent);
            console.log(chalk.green('finished copying webpack config'));
        }
        catch (error) {
            console.log(chalk.red('failed copying webpack config'));
            console.log(chalk.red(error));
            process.exit(1);
        }
    }

    private static async installNativeDependenciesIntoBuild(packageJson: Package): Promise<void> {
        console.log(`installing native dependencies`);
         let packagesToInstall: string[] = [];
        try {
            await fs.mkdir(path.join(process.cwd(), 'bundle', 'node_modules'));
            for (let packageName of packageJson.nativeModules) {
                packagesToInstall.push(`${packageName}@${packageJson.dependencies[packageName]}`);
            }
            process.chdir('bundle');
            await this.npmInstall(packagesToInstall, false);
            process.chdir('..');
            console.log(chalk.green('finished installing native dependencies'));

        }
        catch (error) {
            console.log(chalk.red('failed installing native dependencies'));
            console.log(chalk.red(error));
            console.log(chalk.red(`packages: ${packagesToInstall.join(', ')}`));
            process.exit(1);
        }
    }

    private static async prepare(): Promise<void> {
        await this.installRequiredPackages();
        await this.createElectronEntryPoint();
        await this.preparePacageJson();
        await this.prepareIndexHtml();
        await this.prepareAngularCliConfig();
    }

    private static async build(watch: boolean): Promise<void> {
        let packageJson = await this.readPackageJson();
        if (!await this.fileExists(this.copyConfigPath)) {
            await this.copyWebpackConfig();
        }
        await this.modifyWebpackConfig(packageJson);
        await this.runNgBuild(watch);
    }

    private static async publish(): Promise<void> {
        let packageJson = await this.readPackageJson();
        await this.build(false);
        await this.installNativeDependenciesIntoBuild(packageJson);
        await this.runElectronPacker();
    }

    static async main(): Promise<void> {
        try {
            switch (process.argv[2]) {
                case 'prepare':
                    await this.prepare();
                    break;
                case 'build':
                    let watch: boolean = process.argv[3] == '-w'
                    await this.build(watch);
                    break;
                case 'publish':
                    await this.publish();
                    break;
                default:
                    throw new Error('Invalid command');
            }
        }
        catch (error) {
            console.log(error);
        }
    }
}
Main.main();
