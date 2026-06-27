/**
 * Init Core
 *
 * Project initialization: detect state, prompt for tools, generate files.
 */
export interface InitOptions {
    /** Target project path */
    targetPath: string;
    /** Comma-separated tool list or 'all' */
    tools?: string;
    /** Force overwrite mode */
    force?: boolean;
}
/**
 * Initialize CodeSquad in a project directory.
 */
export declare function initProject(options: InitOptions): Promise<void>;
/**
 * Install project-level files according to Config/project_file_install_config.yaml.
 *
 * Path resolution:
 * - `Root/` prefix in `from` → CLI_PACKAGE_ROOT
 * - `${Project}` placeholder in `dist` → targetPath
 *
 * Existing files are skipped unless `force` is true.
 */
export declare function installProjectFiles(targetPath: string, force?: boolean): number;
//# sourceMappingURL=init-core.d.ts.map