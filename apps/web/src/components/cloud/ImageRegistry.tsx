import { useState } from 'react';
import type { RegistryImage, ImageCategory } from '@qemuweb/vm-config';
import {
  REGISTRY_IMAGES,
  IMAGE_CATEGORIES,
  getImagesByCategory,
  searchImages,
} from '@qemuweb/vm-config';

interface ImageRegistryProps {
  onImageSelected: (image: RegistryImage) => void;
  selectedImage?: RegistryImage | null;
}

export function ImageRegistry({ onImageSelected, selectedImage }: ImageRegistryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ImageCategory | null>(null);
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);

  // Filter images based on search, category, and verified status
  const filteredImages = (() => {
    let images = REGISTRY_IMAGES;

    if (searchQuery) {
      images = searchImages(searchQuery);
    } else if (selectedCategory) {
      images = getImagesByCategory(selectedCategory);
    }

    if (showVerifiedOnly) {
      images = images.filter((img) => img.verified);
    }

    return images;
  })();

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(0)} MB`;
  };

  const categoryKeys = Object.keys(IMAGE_CATEGORIES) as ImageCategory[];

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        Image Registry
      </h2>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search images..."
          className="input w-full"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${
            !selectedCategory
              ? 'bg-indigo-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          All
        </button>
        {categoryKeys.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              selectedCategory === category
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {IMAGE_CATEGORIES[category].name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          id="verifiedOnly"
          checked={showVerifiedOnly}
          onChange={(e) => setShowVerifiedOnly(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="verifiedOnly" className="text-sm text-gray-300">
          Verified images only
        </label>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
        {filteredImages.map((image) => (
          <button
            key={image.id}
            onClick={() => onImageSelected(image)}
            className={`p-3 text-left rounded-lg border transition-colors ${
              selectedImage?.id === image.id
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{image.name}</span>
                {image.verified && (
                  <span className="text-green-400 text-xs" title="Verified">✓</span>
                )}
              </div>
              <span className="text-xs text-gray-500">{image.version}</span>
            </div>

            <p className="text-xs text-gray-400 mb-2 line-clamp-2">{image.description}</p>

            <div className="flex flex-wrap gap-1 mb-2">
              {image.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded"
                >
                  {tag}
                </span>
              ))}
              {image.tags.length > 3 && (
                <span className="text-xs text-gray-500">+{image.tags.length - 3}</span>
              )}
            </div>

            <div className="flex justify-between text-xs text-gray-500">
              <span>{image.architecture}</span>
              <span>{formatSize(image.sizeBytes)}</span>
            </div>

            <div className="flex gap-2 mt-2 text-xs">
              <span className={`px-1.5 py-0.5 rounded ${
                image.category === 'os-minimal' || image.category === 'os-server' ? 'bg-blue-900 text-blue-300' :
                image.category === 'web-server' || image.category === 'database' ? 'bg-green-900 text-green-300' :
                image.category === 'networking' ? 'bg-purple-900 text-purple-300' :
                'bg-gray-700 text-gray-300'
              }`}>
                {IMAGE_CATEGORIES[image.category]?.name ?? image.category}
              </span>
              <span className="text-gray-500">{image.minMemory} MB RAM</span>
            </div>
          </button>
        ))}

        {filteredImages.length === 0 && (
          <div className="col-span-2 text-center py-8 text-gray-500">
            No images found matching your criteria
          </div>
        )}
      </div>

      {/* Selected Image Details */}
      {selectedImage && (
        <div className="border-t border-gray-700 pt-4 mt-4">
          <h3 className="font-medium text-white mb-2">{selectedImage.name} {selectedImage.version}</h3>
          <p className="text-sm text-gray-400 mb-3">{selectedImage.description}</p>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-500">Architecture:</div>
            <div className="text-gray-300">{selectedImage.architecture}</div>

            <div className="text-gray-500">Size:</div>
            <div className="text-gray-300">{formatSize(selectedImage.sizeBytes)}</div>

            <div className="text-gray-500">Min Memory:</div>
            <div className="text-gray-300">{selectedImage.minMemory} MB</div>

            {selectedImage.url && (
              <>
                <div className="text-gray-500">Source:</div>
                <div className="text-gray-300 truncate">
                  <a
                    href={selectedImage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline"
                  >
                    {selectedImage.url}
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
