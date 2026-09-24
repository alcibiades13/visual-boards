import { useBlobUrl } from '@/images/blobUrls';
import { coverAssetIds, type Board, type ImageAsset } from '@/model';

function CoverImage({ asset }: { asset: ImageAsset | undefined }) {
  const url = useBlobUrl(asset?.thumbBlobId);
  return <div className="h-full w-full bg-surface-2">{url && <img src={url} alt="" className="h-full w-full object-cover" />}</div>;
}

/** The chosen cover, or the first four images, or the title set in type. */
export function BoardCover({ board, assets }: { board: Board; assets: Map<string, ImageAsset> }) {
  const ids = coverAssetIds(board);
  if (ids.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-2 p-6">
        <span className="line-clamp-3 text-center font-serif text-2xl text-faint italic">{board.title}</span>
      </div>
    );
  }
  if (ids.length < 4) return <CoverImage asset={assets.get(ids[0]!)} />;
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-0.5">
      {ids.map((id) => (
        <CoverImage key={id} asset={assets.get(id)} />
      ))}
    </div>
  );
}
