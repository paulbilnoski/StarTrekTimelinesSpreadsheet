import STTApi from "../../api/index";
import CONFIG from "../../api/CONFIG";
import { ImageProvider, ImageCache, FoundResult, CrewImageData, ItemImageData } from './ImageProvider';
import { WorkerPool } from '../../api/WorkerPool';
import { ImageDataDTO } from "../../api/DTO";

export class AssetImageProvider implements ImageProvider {
    private _imageCache: ImageCache;
    private _baseURLAsset: string;
    private _workerPool: WorkerPool

    constructor(imageCache: ImageCache) {
        this._imageCache = imageCache;
        this._workerPool = new WorkerPool(5); //TODO: can we get the number of cores somehow?
        this._baseURLAsset = '';
    }

    get baseURLAsset(): string {
        if (this._baseURLAsset.length == 0) {
            this._baseURLAsset = STTApi.serverConfig!.config.asset_server + 'bundles/' + CONFIG.CLIENT_PLATFORM + '/default/' + CONFIG.CLIENT_VERSION + '/' + STTApi.serverConfig!.config.asset_bundle_version + '/';
        }
        return this._baseURLAsset;
    }

    getCached(withIcon: { icon?: ImageDataDTO }): string {
        if (!withIcon.icon)
            return '';

        if (!withIcon.icon.file)
            return '';

        return this._imageCache.getCached(withIcon.icon.file);
    }

    getCrewCached(crew: CrewImageData, fullBody: boolean): string {
        return this._imageCache.getCached(fullBody ? crew.full_body.file : crew.portrait.file);
    }

    getSpriteCached(assetName: string, spriteName: string): string {
        return this._imageCache.getCached(((assetName.length > 0) ? (assetName + '_') : '') + spriteName);
    }

    getCrewImageUrl(crew: CrewImageData, fullBody: boolean): Promise<FoundResult<CrewImageData>> {
        if (!crew) {
            return this.getImageUrl("", crew);
        }
        return this.getImageUrl(fullBody ? crew.full_body.file : crew.portrait.file, crew);
    }

    getItemImageUrl(item: ItemImageData, id: number): Promise<FoundResult<number>> {
        return this.getImageUrl(item.icon.file, id);
    }

    async getSprite(assetName: string, spriteName: string, id: string): Promise<FoundResult<string>> {
        let cachedUrl = await this._imageCache.getImage(((assetName.length > 0) ? (assetName + '_') : '') + spriteName);
        if (cachedUrl) {
            return { id: id, url: cachedUrl };
        }

        let data = await STTApi.networkHelper.getRaw(this.baseURLAsset + ((assetName.length > 0) ? assetName : spriteName) + '.sd', undefined)
        if (!data) {
            throw new Error('Failed to load image');
        }

        let rawBitmap = await new Promise<any>((resolve, reject) => { this._workerPool.addWorkerTask({ data, label: id, resolve, assetName, spriteName }); });
        let url = await this._imageCache.saveImage(((assetName.length > 0) ? (assetName + '_') : '') + spriteName, rawBitmap);
        return { id, url };
    }

    async getImageUrl<T>(iconFile: string, id: T): Promise<FoundResult<T>> {
        if (!iconFile) {
            return {id, url: undefined };
        }
        let cachedUrl = await this._imageCache.getImage(iconFile)
        if (cachedUrl) {
            return { id, url: cachedUrl };
        }

        //console.log('Requesting uncached image ' + iconFile);

        let data: any;
        const urlPrefix = this.getAssetUrl(iconFile);
        try {
            data = await STTApi.networkHelper.getRaw(`${urlPrefix}.sd`, undefined);
        }
        catch (_err) {
            try {
               // Most assets have the .sd extensions, a few have the .ld extension;
               // This is available in asset_bundles but I can't extract that in JavaScript
               data = await STTApi.networkHelper.getRaw(`${urlPrefix}.ld`, undefined);
            }
            catch (_err2) {
               return { id, url: undefined };
            }
        }

        return this.processData(iconFile, id, data);
    }

    private async processData<T>(iconFile: string, id: T, data: any): Promise<FoundResult<T>> {
        if (!data) {
            throw new Error('Fail to load image');
        }

        let rawBitmap = await new Promise<any>((resolve, reject) => {
            this._workerPool.addWorkerTask({ data, label: iconFile, resolve, assetName: undefined, spriteName: undefined });
        });

        let url = await this._imageCache.saveImage(iconFile, rawBitmap);
        return { id, url };
    }

    private getAssetUrl(iconFile: string): string {
        return this.baseURLAsset + 'images' + (iconFile.startsWith('/') ? '' : '_') + iconFile.replace(new RegExp('/', 'g'), '_').replace('.png', '');
    }
}
