//https://clerk.com/docs/references/astro/read-session-data
export const prerender = false;
import { useStore } from "@nanostores/react";
import { $authStore } from "@clerk/astro/client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  Search,
  File,
  FileText,
  Image,
  Video,
  X,
  Folder,
  Plus,
  Tag as TagIcon,
} from "lucide-react";
import { File as FileIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// import { useAuth } from "@clerk/nextjs";

type FileItem = {
  name: string;
  size: number;
  type: string;
  folderId: string | null;
  url?: string;
  visionData?: {
    labels?: string[];
    text?: string;
    ariaDescription?: string;
  };
};

type FolderItem = {
  id: string;
  name: string;
};

// Add new ImageModal component
const ImageModal = ({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden"; // Prevent scrolling when modal is open

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "auto"; // Restore scrolling when modal closes
    };
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="rounded-lg overflow-hidden shadow-2xl">
          <img
            src={imageUrl}
            alt="Full size preview"
            className="max-w-full max-h-[85vh] object-contain"
            onError={(e) => {
              console.error("Image failed to load:", imageUrl);
              e.currentTarget.src = "path-to-fallback-image.jpg"; // Add a fallback image
            }}
          />
        </div>
      </div>
    </div>
  );
};

const VideoPlayer = ({ url, name }: { url: string; name: string }) => {
  return (
    <div className="relative w-full h-48">
      <video
        src={url}
        controls
        className="absolute inset-0 w-full h-full object-cover rounded-lg"
        crossOrigin="anonymous"
      >
        <source src={url} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default function EnhancedDropboxClone() {
  const auth = useStore($authStore);
  const userId = auth?.userId;
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([
    { id: "1", name: "Documents" },
    { id: "2", name: "Images" },
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      if (!userId) return;

      try {
        const response = await fetch(`/api/images?userId=${userId}`);
        if (!response.ok) throw new Error("Failed to fetch files");
        const data = await response.json();

        // Ensure data.files is an array and set folders from the API response
        if (Array.isArray(data.files)) {
          setFiles(data.files);
          // Set folders from the API response, filtering out the folder named "roots"
          const folderNames = data.folders
            .filter((folderName: string) => folderName !== "roots") // Filter out "roots"
            .map((folderName: string) => ({
              id: folderName, // Use folder name as a unique ID
              name: folderName,
            }));
          setFolders(folderNames);

          // Set default selected folder to "root" if it exists
          const rootFolder = folderNames.find(
            (folder: FolderItem) => folder.name === "root"
          );
          if (rootFolder) {
            setSelectedFolder(rootFolder.id); // Set "root" as the default selected folder
          }
        } else {
          console.error("Expected files to be an array:", data.files);
          setFiles([]); // Reset to empty array if not an array
        }
      } catch (error) {
        console.error("Error fetching files:", error);
      }
    };

    fetchFiles();
  }, [userId]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles = acceptedFiles.filter((file) => {
        const isValidType = [
          "application/pdf",
          "text/plain",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "image/jpeg",
          "image/png",
          "image/gif",
          "video/mp4",
        ].includes(file.type);
        const isValidSize = file.type.startsWith("video/")
          ? file.size <= 10 * 1024 * 1024
          : file.size <= 5 * 1024 * 1024;
        return isValidType && isValidSize;
      });

      for (const file of newFiles) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("folder", selectedFolder || "root");

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error("Upload failed");
          }

          const { url } = await response.json();

          // Add Vision AI processing for images
          if (file.type.startsWith("image/")) {
            try {
              const visionResponse = await fetch("/api/analyze-image", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ imageUrl: url }),
              });

              if (!visionResponse.ok) {
                throw new Error("Vision AI analysis failed");
              }

              const visionData = await visionResponse.json();
              console.log("Vision AI results:", visionData);

              // Get the top 3 labels
              const top3Labels = visionData.labels.slice(0, 3);

              // Get description from Aria using Vision AI results
              const ariaResponse = await fetch("/api/aria", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  labels: top3Labels, // Pass only top 3 labels
                  objects: visionData.objects,
                }),
              });

              if (!ariaResponse.ok) throw new Error("Aria analysis failed");
              const ariaData = await ariaResponse.json();

              setFiles((prev) => [
                ...prev,
                {
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  folderId: selectedFolder,
                  url: url,
                  visionData: {
                    labels: top3Labels, // Store only top 3 labels
                    text: visionData.text,
                    ariaDescription: ariaData.description,
                  },
                },
              ]);
            } catch (error) {
              console.error("Error analyzing image:", error);
              // Add the file without vision data if analysis fails
              setFiles((prev) => [
                ...prev,
                {
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  folderId: selectedFolder,
                  url: url,
                },
              ]);
            }
          } else {
            // Handle non-image files
            setFiles((prev) => [
              ...prev,
              {
                name: file.name,
                size: file.size,
                type: file.type,
                folderId: selectedFolder,
                url: url,
              },
            ]);
          }
        } catch (error) {
          console.error("Error uploading file:", error);
          // Handle error appropriately
        }
      }
    },
    [selectedFolder]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const filteredFiles = useMemo(() => {
    return files.filter(
      (file) =>
        selectedFolder === null
          ? true // Show all files if "All Files" is selected
          : file.folderId === selectedFolder // Show files in the selected folder
    );
  }, [files, selectedFolder]);

  const removeFile = (fileName: string) => {
    setFiles((prev) => prev.filter((file) => file.name !== fileName));
  };

  const getFileIcon = (fileType: string) => {
    if (!fileType) return <FileIcon className="w-6 h-6" />;
    if (fileType.startsWith("image/")) return <Image className="w-6 h-6" />;
    if (fileType.startsWith("video/")) return <Video className="w-6 h-6" />;
    if (fileType === "application/pdf") return <FileText className="w-6 h-6" />;
    if (
      fileType === "application/msword" ||
      fileType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return <FileIcon className="w-6 h-6" />;
    }
    return <FileIcon className="w-6 h-6" />;
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      const newFolder: FolderItem = {
        id: Date.now().toString(),
        name: newFolderName.trim(),
      };
      setFolders((prev) => [...prev, newFolder]);
      setNewFolderName("");
      setIsDialogOpen(false);
    }
  };

  // Sample tags for demonstration
  const tags = ["Images", "Documents", "Videos", "Favorites"];

  const handleImageClick = (url: string) => {
    setSelectedImage(url);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  // Effect to handle key press for closing the modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    // Add event listener for keydown
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Effect to handle clicks outside the modal
  const handleClickOutside = (event: MouseEvent) => {
    const modal = document.getElementById("image-modal");
    if (modal && !modal.contains(event.target as Node)) {
      closeModal();
    }
  };

  // Add event listener for clicks outside the modal
  useEffect(() => {
    window.addEventListener("click", handleClickOutside);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <div className="flex h-full bg-gray-100">
      <div className="w-64 bg-white shadow-md flex flex-col">
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Folders</h2>
          <ScrollArea className="min-h-[200px]">
            <ul className="space-y-2">
              <li>
                <Button
                  variant={selectedFolder === null ? "secondary" : "ghost"}
                  className={`w-full justify-start transition-all duration-200 hover:bg-blue-50 ${
                    selectedFolder === null ? "bg-blue-100 text-blue-700" : ""
                  }`}
                  onClick={() => {
                    setSelectedFolder(null); // Set to null for "All Files"
                    setSearchTerm(""); // Clear search term
                  }}
                >
                  <Folder
                    className={`mr-2 h-4 w-4 ${
                      selectedFolder === null ? "text-blue-700" : ""
                    }`}
                  />
                  All Files
                </Button>
              </li>
              {folders.map((folder) => (
                <li key={folder.id}>
                  <Button
                    variant={
                      selectedFolder === folder.id ? "secondary" : "ghost"
                    }
                    className={`w-full justify-start transition-all duration-200 hover:bg-blue-50 ${
                      selectedFolder === folder.id
                        ? "bg-blue-100 text-blue-700"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedFolder(folder.id); // Set selected folder
                      setSearchTerm(""); // Clear search term
                    }}
                  >
                    <Folder
                      className={`mr-2 h-4 w-4 ${
                        selectedFolder === folder.id ? "text-blue-700" : ""
                      }`}
                    />
                    {folder.name}
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
        <div className="p-4">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Input
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                />
                <Button
                  onClick={handleCreateFolder}
                  className="bg-blue-600 hover:bg-blue-700 text-white transition-colors duration-200"
                >
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <Separator />
        {/* Tags Section */}
        <div className="mt-auto">
          <h3 className="text-lg font-semibold mb-2">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1 text-sm font-medium text-white bg-blue-500 rounded-full shadow-md hover:bg-blue-600 transition duration-200"
              >
                <TagIcon className="mr-1 h-4 w-4" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        <h1 className="text-2xl font-bold mb-6">
          {selectedFolder
            ? folders.find((folder) => folder.id === selectedFolder)?.name ||
              "Folder Not Found"
            : "Select a Folder"}
        </h1>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search files..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Drop the files here ...</p>
          ) : (
            <p>Drag 'n' drop some files here, or click to select files</p>
          )}
          <p className="text-sm text-gray-500 mt-2">
            Supported files: PDF, TXT, DOC, DOCX, Images (less than 5MB), Videos
            (less than 10MB)
          </p>
        </div>
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Your Files</h2>
          {filteredFiles.length === 0 ? (
            <p className="text-gray-500">No files found</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {filteredFiles.map((file) => (
                <div key={file.name} className="bg-white p-4 rounded-lg shadow">
                  <div className="mb-2">
                    {file.type.startsWith("image/") ? (
                      <div className="space-y-2">
                        <img
                          src={file.url || ""}
                          alt={file.visionData?.ariaDescription || file.name}
                          className="w-full h-48 object-cover rounded-lg cursor-pointer"
                          onClick={() => handleImageClick(file.url || "")}
                        />
                        {file.visionData?.labels &&
                          file.visionData.labels.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {file.visionData.labels
                                .slice(0, 3)
                                .map((label, index) => (
                                  <span
                                    key={index}
                                    className="px-2 py-1 text-xs font-medium text-white bg-blue-500 rounded-full shadow-sm hover:bg-blue-600 transition-colors"
                                  >
                                    {label}
                                  </span>
                                ))}
                            </div>
                          )}
                      </div>
                    ) : file.type.startsWith("video/") ? (
                      <VideoPlayer url={file.url || ""} name={file.name} />
                    ) : (
                      <div className="w-full h-48 flex items-center justify-center bg-gray-100 rounded-lg">
                        {getFileIcon(file.type)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="truncate">
                      {file.name.split("/").pop()}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(file.name)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedImage && (
          <ImageModal
            imageUrl={selectedImage}
            onClose={() => setSelectedImage(null)}
          />
        )}
      </div>
    </div>
  );
}
