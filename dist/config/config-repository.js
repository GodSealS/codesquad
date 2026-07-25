import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
/**
 * Authoritative workspace configuration access.
 * Legacy root-level config remains readable for backwards compatibility only.
 */
export class ConfigRepository {
    projectRoot;
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
    }
    get modelsConfigPath() {
        return join(this.projectRoot, '.codesquad', 'models.config.yaml');
    }
    get legacyModelsConfigPath() {
        return join(this.projectRoot, 'models.config.yaml');
    }
    readModelsConfig() {
        if (existsSync(this.modelsConfigPath)) {
            return {
                content: readFileSync(this.modelsConfigPath, 'utf-8'),
                source: 'workspace',
                path: this.modelsConfigPath,
            };
        }
        if (existsSync(this.legacyModelsConfigPath)) {
            return {
                content: readFileSync(this.legacyModelsConfigPath, 'utf-8'),
                source: 'legacy',
                path: this.legacyModelsConfigPath,
            };
        }
        return null;
    }
    writeModelsConfig(content) {
        parseYaml(content);
        const dir = join(this.projectRoot, '.codesquad');
        mkdirSync(dir, { recursive: true });
        const temporaryPath = `${this.modelsConfigPath}.tmp.${process.pid}.${Date.now().toString(36)}`;
        writeFileSync(temporaryPath, content, 'utf-8');
        renameSync(temporaryPath, this.modelsConfigPath);
    }
}
//# sourceMappingURL=config-repository.js.map