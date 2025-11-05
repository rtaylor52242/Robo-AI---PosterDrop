
import React, { useState, useCallback, useEffect, FC, ChangeEvent, DragEvent, FormEvent } from 'react';
import { GeneratedVideo, PosterGenerationState, VideoGenerationStatus } from './types';
import { fileToBase64 } from './utils/fileUtils';
import { generatePoster, generateVideoForLocation, getMimeType } from './services/geminiService';
import { DownloadIcon, LoaderIcon, PlusIcon, SparklesIcon, TrashIcon, UploadIcon, VideoIcon, XIcon } from './components/icons';

const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
const defaultLocations = ['Times Square billboard', 'NYC subway lightbox', 'London bus stop', 'Tokyo metro', 'Urban brick wall', 'Mall digital signage'];

// --- Helper Components (defined outside App to prevent re-renders) ---

interface ApiKeySelectorProps {
  onKeySelected: () => void;
}
const ApiKeySelector: FC<ApiKeySelectorProps> = ({ onKeySelected }) => {
  const handleSelectKey = async () => {
    try {
      await (window as any).aistudio.openSelectKey();
      onKeySelected();
    } catch (e) {
      console.error("Error opening API key selector:", e);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 p-4">
      <div className="text-center bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-lg mx-auto border border-gray-700">
        <h2 className="text-3xl font-bold mb-4 text-white">Welcome to PosterDrop</h2>
        <p className="text-gray-400 mb-6">
          This app uses the Google Veo model for video generation, which requires you to select an API key associated with a project that has billing enabled.
        </p>
        <button
          onClick={handleSelectKey}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
        >
          Select API Key to Continue
        </button>
        <p className="text-xs text-gray-500 mt-6">
          For more information about billing, visit{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline"
          >
            ai.google.dev/gemini-api/docs/billing
          </a>.
        </p>
      </div>
    </div>
  );
};

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  setPosterGenerationState: (state: PosterGenerationState) => void;
}
const ImageUploader: FC<ImageUploaderProps> = ({ onImageUpload, setPosterGenerationState }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      onImageUpload(files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-3xl text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-2 text-white">Robo AI - PosterDrop</h1>
        <p className="text-lg md:text-xl text-gray-400 mb-8">Visualize your product as a marketing poster in world-famous locations.</p>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-10 transition-all duration-300 ${isDragging ? 'border-indigo-500 bg-gray-800' : 'border-gray-600 bg-gray-800/50'}`}
        >
          <input
            type="file"
            id="file-upload"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept="image/png, image/jpeg, image/webp"
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleFileChange(e.target.files)}
          />
          <label htmlFor="file-upload" className="flex flex-col items-center justify-center space-y-4 cursor-pointer">
            <UploadIcon className="w-12 h-12 text-gray-500" />
            <p className="text-gray-300"><span className="font-semibold text-indigo-400">Click to upload</span> or drag and drop</p>
            <p className="text-xs text-gray-500">PNG, JPG, WEBP</p>
          </label>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

const App: FC = () => {
  const [posterGenerationState, setPosterGenerationState] = useState<PosterGenerationState>({
    productImage: null,
    posterAspectRatio: '1:1',
    posterSlogan: 'Your Brand, Everywhere.',
    generatedPoster: null,
    locationPrompts: defaultLocations,
    generatedVideos: [],
    isLoadingPoster: false,
    error: null,
  });
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [apiKeySelected, setApiKeySelected] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
        if((window as any).aistudio && typeof (window as any).aistudio.hasSelectedApiKey === 'function') {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            setApiKeySelected(hasKey);
        }
    };
    // Give a small delay for the aistudio object to be available
    setTimeout(checkApiKey, 100);
  }, []);

  const resetApiKey = useCallback(() => setApiKeySelected(false), []);

  const handleImageUpload = async (file: File) => {
    try {
      const dataUrl = await fileToBase64(file);
      setPosterGenerationState(prevState => ({
        ...prevState,
        productImage: dataUrl,
      }));
    } catch (error) {
      console.error('Error converting file to base64', error);
      setPosterGenerationState(prevState => ({ ...prevState, error: 'Failed to load image.' }));
    }
  };
  
  const handleAddPrompt = (e: FormEvent) => {
    e.preventDefault();
    if (currentPrompt && !posterGenerationState.locationPrompts.includes(currentPrompt)) {
      setPosterGenerationState(prevState => ({ ...prevState, locationPrompts: [...prevState.locationPrompts, currentPrompt] }));
      setCurrentPrompt('');
    }
  };

  const handleRemovePrompt = (promptToRemove: string) => {
    setPosterGenerationState(prevState => ({ ...prevState, locationPrompts: prevState.locationPrompts.filter(p => p !== promptToRemove) }));
  };

  const handleGeneratePoster = async () => {
    if (!posterGenerationState.productImage) return;

    setPosterGenerationState(prevState => ({ ...prevState, isLoadingPoster: true, error: null, generatedPoster: null }));

    try {
      // The API needs raw base64, but we store a full data URL.
      const productImageBase64 = posterGenerationState.productImage.split(',')[1];
      const posterBase64 = await generatePoster(
        productImageBase64,
        posterGenerationState.posterSlogan,
        posterGenerationState.posterAspectRatio
      );
      // The API returns raw base64. We need to convert it back to a data URL for display.
      const mimeType = getMimeType(posterBase64);
      const posterDataUrl = `data:${mimeType};base64,${posterBase64}`;
      setPosterGenerationState(prevState => ({ ...prevState, generatedPoster: posterDataUrl, isLoadingPoster: false }));
    } catch (error) {
      console.error('Error generating poster:', error);
      setPosterGenerationState(prevState => ({ ...prevState, error: 'Failed to generate poster. Please try again.', isLoadingPoster: false }));
    }
  };

  const handleGenerateVideos = async () => {
    if (!posterGenerationState.generatedPoster || posterGenerationState.locationPrompts.length === 0) return;

    const initialVideos: GeneratedVideo[] = posterGenerationState.locationPrompts.map((prompt, index) => ({
      id: `${Date.now()}-${index}`,
      prompt,
      url: null,
      status: VideoGenerationStatus.GENERATING,
    }));

    setPosterGenerationState(prevState => ({ ...prevState, generatedVideos: initialVideos, error: null }));
    
    // The API needs raw base64, but we store a full data URL for the poster.
    const posterBase64 = posterGenerationState.generatedPoster.split(',')[1];

    posterGenerationState.locationPrompts.forEach((prompt, index) => {
      generateVideoForLocation(posterBase64, prompt, posterGenerationState.posterAspectRatio, resetApiKey)
        .then(videoUrl => {
          setPosterGenerationState(prevState => ({
            ...prevState,
            generatedVideos: prevState.generatedVideos.map(v => v.id === initialVideos[index].id ? { ...v, url: videoUrl, status: VideoGenerationStatus.COMPLETED } : v),
          }));
        })
        .catch(error => {
          console.error(`Error generating video for "${prompt}":`, error);
          setPosterGenerationState(prevState => ({
            ...prevState,
            generatedVideos: prevState.generatedVideos.map(v => v.id === initialVideos[index].id ? { ...v, status: VideoGenerationStatus.FAILED } : v),
            error: prevState.error ? prevState.error + `\nFailed video for "${prompt}".` : `Failed video for "${prompt}".`
          }));
        });
    });
  };

  const handleStartOver = () => {
    setPosterGenerationState({
      productImage: null,
      posterAspectRatio: '1:1',
      posterSlogan: 'Your Brand, Everywhere.',
      generatedPoster: null,
      locationPrompts: defaultLocations,
      generatedVideos: [],
      isLoadingPoster: false,
      error: null,
    });
    setCurrentPrompt('');
  };
  
  if (!apiKeySelected) {
    return <ApiKeySelector onKeySelected={() => setApiKeySelected(true)} />;
  }

  if (!posterGenerationState.productImage) {
    return <ImageUploader onImageUpload={handleImageUpload} setPosterGenerationState={setPosterGenerationState} />;
  }
  
  const isGeneratingVideos = posterGenerationState.generatedVideos.some(v => v.status === VideoGenerationStatus.GENERATING);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-2xl font-bold">PosterDrop Dashboard</h1>
        <button onClick={handleStartOver} className="text-sm bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
          Start Over
        </button>
      </header>
      
      <main className="flex-grow grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
        {/* --- Controls Panel --- */}
        <div className="lg:col-span-1 xl:col-span-1 bg-gray-800 rounded-2xl p-6 flex flex-col gap-6 overflow-y-auto h-[calc(100vh-100px)]">
          <div>
            <h2 className="text-xl font-semibold mb-3 text-white">1. Uploaded Product</h2>
            <img src={posterGenerationState.productImage} alt="Uploaded product" className="rounded-lg w-full object-cover aspect-square" />
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3 text-white">2. Customize Poster</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="slogan" className="block text-sm font-medium text-gray-400 mb-1">Slogan</label>
                <input
                  type="text"
                  id="slogan"
                  value={posterGenerationState.posterSlogan}
                  onChange={(e) => setPosterGenerationState(prevState => ({ ...prevState, posterSlogan: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                  placeholder="e.g., Live in the Moment"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  {aspectRatios.map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setPosterGenerationState(prevState => ({ ...prevState, posterAspectRatio: ratio }))}
                      className={`py-2 px-3 text-sm rounded-md transition-colors ${posterGenerationState.posterAspectRatio === ratio ? 'bg-indigo-600 text-white font-semibold' : 'bg-gray-700 hover:bg-gray-600'}`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={handleGeneratePoster}
            disabled={posterGenerationState.isLoadingPoster}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:bg-indigo-800 disabled:cursor-not-allowed"
          >
            {posterGenerationState.isLoadingPoster ? <LoaderIcon /> : <SparklesIcon />}
            {posterGenerationState.isLoadingPoster ? 'Generating...' : 'Generate Poster'}
          </button>

          <div>
            <h2 className="text-xl font-semibold mb-3 text-white">3. Choose Locations</h2>
            <form onSubmit={handleAddPrompt} className="flex gap-2 mb-3">
              <input
                type="text"
                value={currentPrompt}
                onChange={(e) => setCurrentPrompt(e.target.value)}
                className="flex-grow bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                placeholder="Add a new location..."
              />
              <button type="submit" className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-colors"><PlusIcon /></button>
            </form>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              {posterGenerationState.locationPrompts.map(prompt => (
                <div key={prompt} className="flex items-center justify-between bg-gray-700 rounded-md p-2 text-sm">
                  <span className="truncate pr-2">{prompt}</span>
                  <button onClick={() => handleRemovePrompt(prompt)} className="text-gray-400 hover:text-red-400 transition-colors"><TrashIcon /></button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerateVideos}
            disabled={!posterGenerationState.generatedPoster || isGeneratingVideos}
            className="w-full mt-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:bg-green-800 disabled:cursor-not-allowed"
          >
            {isGeneratingVideos ? <LoaderIcon /> : <VideoIcon />}
            {isGeneratingVideos ? 'Generating Videos...' : 'Generate Videos'}
          </button>
        </div>

        {/* --- Results Panel --- */}
        <div className="lg:col-span-2 xl:col-span-3 bg-gray-900 rounded-2xl overflow-y-auto h-[calc(100vh-100px)]">
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {posterGenerationState.isLoadingPoster && (
                  <div className="md:col-span-2 xl:col-span-3 flex items-center justify-center aspect-video bg-gray-800 rounded-lg">
                      <div className="text-center">
                          <LoaderIcon className="w-12 h-12" />
                          <p className="mt-2 text-lg font-semibold">Generating Poster...</p>
                          <p className="text-sm text-gray-400">The AI is getting creative.</p>
                      </div>
                  </div>
              )}
              {posterGenerationState.error && (
                <div className="md:col-span-2 xl:col-span-3 bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">
                    <h3 className="font-bold">An Error Occurred</h3>
                    <pre className="text-sm whitespace-pre-wrap">{posterGenerationState.error}</pre>
                </div>
              )}
              {posterGenerationState.generatedPoster && (
                  <div className="md:col-span-2 xl:col-span-3">
                      <h3 className="text-2xl font-bold mb-4">Generated Poster</h3>
                      <img src={posterGenerationState.generatedPoster} alt="Generated Poster" className="rounded-xl shadow-lg w-full max-w-2xl mx-auto"/>
                  </div>
              )}
              {posterGenerationState.generatedVideos.map(video => (
                <div key={video.id} className="bg-gray-800 rounded-lg overflow-hidden shadow-lg flex flex-col">
                  <div className="aspect-video bg-black flex items-center justify-center">
                    {video.status === VideoGenerationStatus.GENERATING && (
                      <div className="text-center p-4">
                        <LoaderIcon />
                        <p className="text-sm font-semibold mt-2">Generating Video...</p>
                      </div>
                    )}
                    {video.status === VideoGenerationStatus.COMPLETED && video.url && (
                      <video src={video.url} controls autoPlay loop muted className="w-full h-full object-cover"></video>
                    )}
                    {video.status === VideoGenerationStatus.FAILED && (
                       <div className="text-center text-red-400 p-4">
                        <XIcon />
                        <p className="text-sm font-semibold mt-2">Generation Failed</p>
                       </div>
                    )}
                  </div>
                  <div className="p-3 flex-grow flex flex-col">
                      <p className="text-sm font-semibold text-gray-300 flex-grow">{video.prompt}</p>
                      {video.status === VideoGenerationStatus.COMPLETED && video.url && (
                          <a href={video.url} download={`${video.prompt.replace(/\s/g, '_')}.mp4`} className="mt-2 text-sm w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-md transition-colors">
                              <DownloadIcon />
                              Download
                          </a>
                      )}
                  </div>
                </div>
              ))}
            </div>
        </div>
      </main>
    </div>
  );
};

export default App;
