/**
 * Template Copier
 *
 * Copies template files from the CLI package's docs/ directory
 * into a project's docs/ directory. Used by `codesquad start`.
 * (init uses installProjectFiles via Config/project_file_install_config.yaml)
 */
export interface CopyResult {
    /** Total files copied */
    copied: number;
    /** Files skipped because they already exist */
    skipped: number;
    /** Status for each copied file */
    files: Array<{
        source: string;
        dest: string;
        status: 'copied' | 'skipped' | 'error';
        error?: string;
    }>;
}
/**
 * Copy template docs directory to the target project.
 * Skips files that already exist in the target (unless force is true).
 */
export declare function copyTemplates(targetPath: string, force?: boolean): CopyResult;
/** Print a summary of the copy operation */
export declare function printCopySummary(result: CopyResult): void;
//# sourceMappingURL=template-copier.d.ts.map