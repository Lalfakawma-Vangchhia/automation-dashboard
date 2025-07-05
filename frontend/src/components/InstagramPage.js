import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import './InstagramPage.css';

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4'];

const InstagramPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, user } = useAuth();

  // UI State
  const [isConnected, setIsConnected] = useState(false);
  const [instagramAccounts, setInstagramAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [activeTab, setActiveTab] = useState('connect');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [fbAccessToken, setFbAccessToken] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Post State
  const [postType, setPostType] = useState('photo'); // photo | carousel | reel
  const [caption, setCaption] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiImageUrl, setAiImageUrl] = useState('');
  const [imageSource, setImageSource] = useState('ai'); // ai | upload | drive
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [autoGenerateCaption, setAutoGenerateCaption] = useState(false);
  const [captionPrompt, setCaptionPrompt] = useState('');
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);

  // Carousel State
  const [carouselImages, setCarouselImages] = useState([]); // URLs
  const [carouselFiles, setCarouselFiles] = useState([]); // File objects
  const [carouselCount, setCarouselCount] = useState(3);
  const [carouselCaption, setCarouselCaption] = useState('');
  const [carouselGenerating, setCarouselGenerating] = useState(false);

  // Reel State
  const [reelFile, setReelFile] = useState(null);
  const [reelUrl, setReelUrl] = useState('');
  const [reelCaption, setReelCaption] = useState('');
  const [reelUploading, setReelUploading] = useState(false);
  const [reelAutoGenerateCaption, setReelAutoGenerateCaption] = useState(false);
  const [reelCaptionPrompt, setReelCaptionPrompt] = useState('');
  const [generatingReelCaption, setGeneratingReelCaption] = useState(false);

  // Media Gallery
  const [userMedia, setUserMedia] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Google Drive Integration
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveFiles, setDriveFiles] = useState([]);
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false);
  const [driveAuthenticated, setDriveAuthenticated] = useState(false);
  const [driveAuthLoading, setDriveAuthLoading] = useState(false);

  // File Picker Modal State
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [filePickerType, setFilePickerType] = useState(''); // 'photo' or 'video'
  const [filePickerFormType, setFilePickerFormType] = useState(''); // 'manual' or 'auto'
  const [isLoadingGoogleDrive, setIsLoadingGoogleDrive] = useState(false);
  const [googleDriveAvailable, setGoogleDriveAvailable] = useState(false);

  // Facebook SDK
  const INSTAGRAM_APP_ID = process.env.REACT_APP_INSTAGRAM_APP_ID || '697225659875731';

  // --- Facebook SDK Helpers ---
  const checkLoginStatus = () => {
    if (!window.FB || !isAuthenticated) return;
    window.FB.getLoginStatus((response) => {
      if (response.status === 'connected') {
        setFbAccessToken(response.authResponse.accessToken);
        setMessage('Instagram: Using existing Facebook login session');
        handleConnectInstagram(response.authResponse.accessToken);
      } else {
        setMessage('Instagram: Please connect your Facebook account to continue');
      }
    });
  };
  const initializeFacebookSDK = () => {
    if (window.FB) {
      window.FB.init({ appId: INSTAGRAM_APP_ID, cookie: true, xfbml: true, version: 'v18.0' });
      setSdkLoaded(true);
      checkLoginStatus();
      return;
    }
    window.fbAsyncInit = function() {
      window.FB.init({ appId: INSTAGRAM_APP_ID, cookie: true, xfbml: true, version: 'v18.0' });
      setSdkLoaded(true);
      checkLoginStatus();
    };
    (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s); js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
  };

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      checkLoginStatus();
      initializeFacebookSDK();
      checkGoogleDriveAvailability();
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    checkLoginStatus();
    initializeFacebookSDK();
    // eslint-disable-next-line
  }, [INSTAGRAM_APP_ID, isAuthenticated]);

  // --- Instagram Connect ---
  const handleConnectInstagram = async (accessToken = fbAccessToken) => {
    if (!isAuthenticated) {
      setMessage('Please log in to your account first before connecting Instagram.');
      setLoading(false);
      return;
    }
    if (!accessToken) {
      setMessage('No access token available. Please log in with Facebook first.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setMessage('Fetching Instagram Business accounts...');
      const response = await apiClient.connectInstagram(accessToken);
      if (response.success && response.data && response.data.accounts && response.data.accounts.length > 0) {
        const mappedAccounts = response.data.accounts.map(account => ({
          id: account.platform_id,
          username: account.username,
          name: account.display_name || account.page_name,
          followers_count: account.followers_count || 0,
          media_count: account.media_count || 0,
          profile_picture_url: account.profile_picture
        }));
        setInstagramAccounts(mappedAccounts);
        setIsConnected(true);
        setActiveTab('post');
        setMessage(`Found ${mappedAccounts.length} Instagram Business account(s)!`);
        if (mappedAccounts.length === 1) {
          setSelectedAccount(mappedAccounts[0]);
          loadUserMedia(mappedAccounts[0].id);
        }
      } else {
        setMessage('No Instagram Business accounts found. Make sure you have an Instagram Business account connected to your Facebook Page.');
      }
    } catch (error) {
      setMessage(error.message || 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = () => {
    if (!window.FB) {
      setMessage('Facebook SDK not loaded');
      return;
    }
    setLoading(true);
    setMessage('Initiating Instagram OAuth via Facebook...');
    window.FB.login((response) => {
      if (response.status === 'connected') {
        const accessToken = response.authResponse.accessToken;
        setFbAccessToken(accessToken);
        setMessage('Facebook login successful! Connecting Instagram accounts...');
        handleConnectInstagram(accessToken);
      } else {
        setMessage('Facebook login failed or was cancelled');
        setLoading(false);
      }
    }, {
      scope: 'pages_show_list,instagram_basic,instagram_content_publish,pages_read_engagement'
    });
  };

  // --- Media Loading ---
  const loadUserMedia = async (instagramUserId) => {
    setLoadingMedia(true);
    try {
      const media = await apiClient.getInstagramMedia(instagramUserId);
      setUserMedia(media?.data?.media || []);
    } catch (error) {
      setMessage(`Error loading media: ${error.message}`);
    } finally {
      setLoadingMedia(false);
    }
  };

  // --- Image Upload ---
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setMessage('Please select a PNG or JPG image');
      return;
    }

    // Debug authentication status
    console.log('🔍 DEBUG: Authentication check before upload');
    console.log('🔍 DEBUG: isAuthenticated:', isAuthenticated);
    console.log('🔍 DEBUG: user:', user);
    console.log('🔍 DEBUG: apiClient token exists:', !!apiClient.token);
    
    setUploadingImage(true);
    setMessage('Uploading image...');
    try {
      const res = await apiClient.uploadImageToCloudinary(file);
      if (res && res.success && res.data && res.data.url) {
        setUploadedImageUrl(res.data.url);
        setAiImageUrl(res.data.url);
        setSelectedImageFile(file);
        setMessage('Image uploaded successfully!');
      } else {
        throw new Error(res?.error || 'Upload failed');
      }
    } catch (err) {
      console.error('🔍 DEBUG: Upload error details:', err);
      setMessage(`Image upload failed: ${err.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  // --- AI Image Generation ---
  const handleGenerateAIImage = async () => {
    if (!aiPrompt.trim()) {
      setMessage('Please enter a prompt for image generation.');
      return;
    }
    
    setAiGenerating(true);
    setMessage('Generating Instagram-optimized image with AI...');
    
    try {
      console.log('🔍 DEBUG: Generating Instagram image with prompt:', aiPrompt.trim());
      
      const res = await apiClient.generateInstagramImage(aiPrompt.trim());
      console.log('🔍 DEBUG: Image generation response:', res);
      
      if (res && res.success && res.data && res.data.image_url) {
        setAiImageUrl(res.data.image_url);
        const dimensions = res.data.width && res.data.height ? `(${res.data.width}x${res.data.height})` : '';
        setMessage(`AI image generated successfully! ${dimensions}`);
        console.log('🔍 DEBUG: Generated image URL:', res.data.image_url);
        console.log('🔍 DEBUG: Image dimensions:', res.data.width, 'x', res.data.height);
        console.log('🔍 DEBUG: Enhanced prompt:', res.data.enhanced_prompt);
      } else if (res && res.data && res.data.image_url) {
        // Fallback for different response format
        setAiImageUrl(res.data.image_url);
        setMessage('AI image generated successfully!');
        console.log('🔍 DEBUG: Generated image URL (fallback):', res.data.image_url);
      } else {
        console.error('🔍 DEBUG: Invalid response format:', res);
        setMessage('Failed to generate image. Please try again.');
      }
    } catch (err) {
      console.error('🔍 DEBUG: Image generation error:', err);
      
      // Handle specific error types
      let errorMessage = err.message || err.toString();
      
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Invalid or expired Stability AI API key. Please check your API key in the backend configuration.';
      } else if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        errorMessage = 'Rate limit exceeded. Please wait a few minutes before trying again, or upgrade your Stability AI plan.';
        // Set a 5-minute cooldown
        setRateLimitCooldown(300);
        const cooldownInterval = setInterval(() => {
          setRateLimitCooldown(prev => {
            if (prev <= 1) {
              clearInterval(cooldownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        errorMessage = 'Server error occurred. Please try again in a moment.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      }
      
      setMessage('Error generating image: ' + errorMessage);
    } finally {
      setAiGenerating(false);
    }
  };

  // --- Auto Generate Caption ---
  const handleAutoGenerateCaption = async () => {
    if (!captionPrompt.trim()) {
      setMessage('Please enter a prompt for caption generation.');
      return;
    }
    
    setGeneratingCaption(true);
    setMessage('Generating caption with AI...');
    
    try {
      console.log('🔍 DEBUG: Generating Instagram caption with prompt:', captionPrompt.trim());
      
      const res = await apiClient.generateInstagramCaption(captionPrompt.trim());
      console.log('🔍 DEBUG: Caption generation response:', res);
      
      if (res && res.success && res.data && res.data.content) {
        setCaption(res.data.content);
        setMessage('Caption generated successfully!');
        console.log('🔍 DEBUG: Generated caption:', res.data.content);
      } else if (res && res.content) {
        // Fallback for different response format
        setCaption(res.content);
        setMessage('Caption generated successfully!');
        console.log('🔍 DEBUG: Generated caption (fallback):', res.content);
      } else {
        console.error('🔍 DEBUG: Invalid response format:', res);
        setMessage('Failed to generate caption. Please try again.');
      }
    } catch (err) {
      console.error('🔍 DEBUG: Caption generation error:', err);
      setMessage('Error generating caption: ' + (err.message || err.toString()));
    } finally {
      setGeneratingCaption(false);
    }
  };

  // --- Generate Image and Caption Together ---
  const handleGenerateImageAndCaption = async () => {
    if (!aiPrompt.trim()) {
      setMessage('Please enter a prompt for generation.');
      return;
    }

    setAiGenerating(true);
    setGeneratingCaption(true);
    setMessage('Generating Instagram-optimized image and caption with AI...');
    
    try {
      console.log('🔍 DEBUG: Generating image and caption with prompt:', aiPrompt.trim());
      
      // Generate image first
      const imageRes = await apiClient.generateInstagramImage(aiPrompt.trim());
      console.log('🔍 DEBUG: Image generation response:', imageRes);
      
      if (!imageRes || !imageRes.success || !imageRes.data || !imageRes.data.image_url) {
        throw new Error('Failed to generate image');
      }
      
      setAiImageUrl(imageRes.data.image_url);
      console.log('🔍 DEBUG: Generated image URL:', imageRes.data.image_url);
      console.log('🔍 DEBUG: Image dimensions:', imageRes.data.width, 'x', imageRes.data.height);
      
      // Generate caption using the same prompt
      const captionRes = await apiClient.generateInstagramCaption(aiPrompt.trim());
      console.log('🔍 DEBUG: Caption generation response:', captionRes);
      
      if (captionRes && captionRes.success && captionRes.data && captionRes.data.content) {
        setCaption(captionRes.data.content);
        console.log('🔍 DEBUG: Generated caption:', captionRes.data.content);
      } else if (captionRes && captionRes.content) {
        // Fallback for different response format
        setCaption(captionRes.content);
        console.log('🔍 DEBUG: Generated caption (fallback):', captionRes.content);
      } else {
        console.warn('🔍 DEBUG: Caption generation failed, using fallback');
        setCaption(`Check out this amazing image! ${aiPrompt.trim()}`);
      }
      
      const dimensions = imageRes.data.width && imageRes.data.height ? `(${imageRes.data.width}x${imageRes.data.height})` : '';
      setMessage(`Image and caption generated successfully! ${dimensions}`);
      
    } catch (err) {
      console.error('🔍 DEBUG: Image and caption generation error:', err);
      
      // Handle specific error types
      let errorMessage = err.message || err.toString();
      
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Invalid or expired Stability AI API key. Please check your API key in the backend configuration.';
      } else if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        errorMessage = 'Rate limit exceeded. Please wait a few minutes before trying again, or upgrade your Stability AI plan.';
        // Set a 5-minute cooldown
        setRateLimitCooldown(300);
        const cooldownInterval = setInterval(() => {
          setRateLimitCooldown(prev => {
            if (prev <= 1) {
              clearInterval(cooldownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        errorMessage = 'Server error occurred. Please try again in a moment.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      }
      
      setMessage('Error generating image and caption: ' + errorMessage);
      
      // Clear any partial results on error
      setAiImageUrl('');
      setCaption('');
    } finally {
      setAiGenerating(false);
      setGeneratingCaption(false);
    }
  };

  // --- Retry Image Generation ---
  const handleRetryImageGeneration = async () => {
    if (!aiPrompt.trim()) {
      setMessage('Please enter a prompt for image generation.');
        return;
    }
    
    setAiGenerating(true);
    setMessage('Retrying image generation...');
    
    try {
      console.log('🔍 DEBUG: Retrying image generation with prompt:', aiPrompt.trim());
      
      const res = await apiClient.generateInstagramImage(aiPrompt.trim());
      console.log('🔍 DEBUG: Retry image generation response:', res);
      
      if (res && res.success && res.data && res.data.image_url) {
        setAiImageUrl(res.data.image_url);
        setMessage('Image generated successfully on retry!');
        console.log('🔍 DEBUG: Generated image URL (retry):', res.data.image_url);
      } else if (res && res.data && res.data.image_url) {
        // Fallback for different response format
        setAiImageUrl(res.data.image_url);
        setMessage('Image generated successfully on retry!');
        console.log('🔍 DEBUG: Generated image URL (retry fallback):', res.data.image_url);
      } else {
        console.error('🔍 DEBUG: Invalid response format on retry:', res);
        setMessage('Failed to generate image on retry. Please try again.');
      }
    } catch (err) {
      console.error('🔍 DEBUG: Retry image generation error:', err);
      
      // Handle specific error types
      let errorMessage = err.message || err.toString();
      
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Invalid or expired Stability AI API key. Please check your API key in the backend configuration.';
      } else if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        errorMessage = 'Rate limit exceeded. Please wait a few minutes before trying again, or upgrade your Stability AI plan.';
        // Set a 5-minute cooldown
        setRateLimitCooldown(300);
        const cooldownInterval = setInterval(() => {
          setRateLimitCooldown(prev => {
            if (prev <= 1) {
              clearInterval(cooldownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        errorMessage = 'Server error occurred. Please try again in a moment.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      }
      
      setMessage('Error retrying image generation: ' + errorMessage);
    } finally {
      setAiGenerating(false);
    }
  };

  // --- Carousel Upload ---
  const handleCarouselFilesChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length < 3 || files.length > 7) {
      setMessage('Please select 3 to 7 images.');
      return;
    }
    setCarouselGenerating(true);
    setMessage('Uploading carousel images...');
    try {
      const urls = [];
      for (const file of files) {
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
          setMessage('All images must be PNG or JPG.');
          setCarouselGenerating(false);
          return;
        }
        const res = await apiClient.uploadImageToCloudinary(file);
        if (res && res.success && res.data && res.data.url) {
          urls.push(res.data.url);
      } else {
          throw new Error(res?.error || 'Upload failed');
        }
      }
      setCarouselImages(urls);
      setMessage(`Uploaded ${urls.length} images for carousel.`);
    } catch (err) {
      setMessage('Error uploading carousel images: ' + err.message);
    } finally {
      setCarouselGenerating(false);
    }
  };

  // --- Carousel Auto Generate Caption ---
  const handleCarouselAutoGenerateCaption = async () => {
    if (!captionPrompt.trim()) {
      setMessage('Please provide a prompt for caption generation.');
      return;
    }
    
    setGeneratingCaption(true);
    setMessage('Generating carousel caption...');
    
    try {
      const result = await apiClient.generateInstagramCaption(captionPrompt.trim());
      if (result.success && result.content) {
        setCarouselCaption(result.content);
        setMessage('Caption generated successfully!');
      } else {
        setMessage('Failed to generate caption: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      setMessage('Error generating caption: ' + err.message);
    } finally {
      setGeneratingCaption(false);
    }
  };

  // --- Reel Upload ---
  const handleReelFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      setMessage('Only .mp4 files are allowed.');
      return;
    }
    setReelUploading(true);
    setMessage('Uploading video...');
    try {
      const res = await apiClient.uploadVideoToCloudinary(file);
      console.log('Video upload response:', res);
      
      // Check for different response structures
      if (res && res.success && (res.url || res.data?.url)) {
        const videoUrl = res.url || res.data?.url;
        setReelUrl(videoUrl);
        setReelFile(file);
        setMessage('Video uploaded successfully!');
      } else if (res && res.data && res.data.url) {
        // Alternative response structure
        setReelUrl(res.data.url);
        setReelFile(file);
        setMessage('Video uploaded successfully!');
      } else {
        throw new Error(res?.error || res?.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Video upload error:', err);
      setMessage('Error: ' + (err.message || err.toString()));
    } finally {
      setReelUploading(false);
    }
  };

  // --- Reel Auto Generate Caption ---
  const handleReelAutoGenerateCaption = async () => {
    if (!reelCaptionPrompt.trim()) {
      setMessage('Please provide a prompt for caption generation.');
      return;
    }
    
    setGeneratingReelCaption(true);
    setMessage('Generating reel caption...');
    
    try {
      const result = await apiClient.generateInstagramCaption(reelCaptionPrompt.trim());
      if (result.success && result.content) {
        setReelCaption(result.content);
        setMessage('Reel caption generated successfully!');
      } else {
        setMessage('Failed to generate caption: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      setMessage('Error generating caption: ' + err.message);
    } finally {
      setGeneratingReelCaption(false);
    }
  };

  // --- Google Drive Integration ---
  const checkGoogleDriveAuth = async () => {
    try {
      const response = await apiClient.getGoogleDriveStatus();
      setDriveAuthenticated(response.authenticated);
      return response.authenticated;
    } catch (error) {
      console.error('Error checking Google Drive auth:', error);
      setDriveAuthenticated(false);
      return false;
    }
  };

  const authenticateGoogleDrive = async () => {
    setDriveAuthLoading(true);
    try {
      const response = await apiClient.getGoogleDriveAuthorizeUrl();
      if (response.consent_url) {
        // Open popup for OAuth
        const popup = window.open(
          response.consent_url,
          'google-drive-auth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        // Listen for OAuth completion
        const handleMessage = (event) => {
          if (event.data.success) {
            setDriveAuthenticated(true);
            setMessage('Google Drive connected successfully!');
            loadDriveFiles();
          } else if (event.data.error) {
            setMessage(`Google Drive authentication failed: ${event.data.error}`);
          }
          window.removeEventListener('message', handleMessage);
          if (popup) popup.close();
        };

        window.addEventListener('message', handleMessage);
      } else if (response.already_authenticated) {
        setDriveAuthenticated(true);
        setMessage('Google Drive already authenticated!');
        loadDriveFiles();
      }
    } catch (error) {
      setMessage(`Google Drive authentication error: ${error.message}`);
    } finally {
      setDriveAuthLoading(false);
    }
  };

  const loadDriveFiles = async () => {
    if (!driveAuthenticated) return;
    
    setLoadingDriveFiles(true);
    try {
      const response = await apiClient.getGoogleDriveFiles('image/');
      if (response.success && response.files) {
        setDriveFiles(response.files);
      } else {
        setMessage('Failed to load Google Drive files');
      }
    } catch (error) {
      setMessage(`Error loading Google Drive files: ${error.message}`);
    } finally {
      setLoadingDriveFiles(false);
    }
  };

  const handleDriveFileSelect = async (fileId, fileName) => {
    setUploadingImage(true);
    setMessage('Downloading file from Google Drive...');
    try {
      const response = await apiClient.downloadGoogleDriveFile(fileId);
      if (response.success && response.fileContent) {
        // Convert base64 to blob and upload to Cloudinary
        const byteCharacters = atob(response.fileContent);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: response.mimeType });
        
        // Create a File object from the blob
        const file = new File([blob], fileName, { type: response.mimeType });
        
        // Upload to Cloudinary
        const uploadResponse = await apiClient.uploadImageToCloudinary(file);
        if (uploadResponse.success && uploadResponse.data && uploadResponse.data.url) {
          setUploadedImageUrl(uploadResponse.data.url);
          setAiImageUrl(uploadResponse.data.url);
          setMessage('File uploaded from Google Drive successfully!');
          setShowDriveModal(false);
        } else {
          throw new Error(uploadResponse.error || 'Upload failed');
        }
      } else {
        throw new Error(response.error || 'Download failed');
      }
    } catch (error) {
      setMessage(`Error processing Google Drive file: ${error.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const openDriveModal = async () => {
    const isAuth = await checkGoogleDriveAuth();
    if (!isAuth) {
      await authenticateGoogleDrive();
    } else {
      await loadDriveFiles();
    }
    setShowDriveModal(true);
  };

  // File Picker Functions
  const openFilePicker = (type, formType) => {
    setFilePickerType(type);
    setFilePickerFormType(formType);
    setShowFilePicker(true);
  };

  const closeFilePicker = () => {
    setShowFilePicker(false);
    setFilePickerType('');
    setFilePickerFormType('');
    setIsLoadingGoogleDrive(false);
  };

  const handleLocalFileSelect = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    if (filePickerFormType === 'carousel') {
      // Handle carousel upload
      handleCarouselFilesChange({ target: { files } });
    } else {
      // Handle single file upload
      const file = files[0];
      if (filePickerType === 'photo') {
        handleImageChange({ target: { files: [file] } });
      } else if (filePickerType === 'video') {
        handleReelFileChange({ target: { files: [file] } });
      }
    }
    closeFilePicker();
  };

  const handleGoogleDriveSelect = async () => {
    setIsLoadingGoogleDrive(true);
    try {
      // Check if already authenticated
      const status = await apiClient.getGoogleDriveStatus();
      if (!status.authenticated) {
        // Get consent URL for popup
        const authResponse = await apiClient.getGoogleDriveAuthorizeUrl();
        if (authResponse.consent_url) {
          // Open popup and wait for completion
          await openDriveAuthPopup(authResponse.consent_url);
        }
      }

      // After popup closes, re-check authentication status
      const finalStatus = await apiClient.getGoogleDriveStatus();
      if (!finalStatus.authenticated) {
        throw new Error('Authentication was not completed successfully');
      }

      // Update state and proceed with Google Drive picker
      setGoogleDriveAvailable(true);

      // Initialize Google Drive API
      await loadGoogleDriveAPI();
      
      // Check if google object is available
      if (typeof window.google === 'undefined' || !window.google.picker) {
        throw new Error('Google Picker API failed to load');
      }
      
      // Get fresh token for picker
      const authResult = await apiClient.getGoogleDriveAuth();
      
      // Open Google Drive picker
      const picker = new window.google.picker.PickerBuilder()
        .addView(new window.google.picker.DocsView()
          .setIncludeFolders(true)
          .setSelectFolderEnabled(false)
          .setMimeTypes(filePickerType === 'photo' ? 'image/*' : 'video/*'))
        .setOAuthToken(authResult.access_token)
        .setDeveloperKey(process.env.REACT_APP_GOOGLE_DEVELOPER_KEY || '')
        .setCallback(handleGoogleDriveCallback)
        .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
        .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED, filePickerFormType === 'carousel')
        .setTitle(filePickerFormType === 'carousel' ? 'Select multiple files from Google Drive' : 'Select a file from Google Drive')
        .setSelectableMimeTypes(filePickerType === 'photo' ? 'image/*' : 'video/*')
        .build();
      
      picker.setVisible(true);
      
    } catch (error) {
      console.error('Error with Google Drive selection:', error);
      setMessage(`Google Drive error: ${error.message}`);
    } finally {
      setIsLoadingGoogleDrive(false);
    }
  };

  const loadGoogleDriveAPI = () => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.picker) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        if (window.gapi) {
          window.gapi.load('picker', () => {
            resolve();
          });
        } else {
          reject(new Error('Google API failed to load'));
        }
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const openDriveAuthPopup = (authUrl) => {
    return new Promise((resolve, reject) => {
      const popup = window.open(
        authUrl,
        'google-drive-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      const messageHandler = (event) => {
        if (event.data.success) {
          setGoogleDriveAvailable(true);
          setMessage('Google Drive connected successfully!');
          resolve();
        } else if (event.data.error) {
          setMessage(`Google Drive authentication failed: ${event.data.error}`);
          reject(new Error(event.data.error));
        }
        window.removeEventListener('message', messageHandler);
        if (popup) popup.close();
      };

      window.addEventListener('message', messageHandler);

      // Timeout after 5 minutes
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        if (popup) popup.close();
        reject(new Error('Authentication timeout'));
      }, 300000);
    });
  };

  const handleGoogleDriveCallback = async (data) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const files = data.docs;
      try {
        if (filePickerFormType === 'carousel') {
          // Handle multiple files for carousel
          const fileObjects = [];
          for (const file of files) {
            const fileContent = await downloadGoogleDriveFile(file.id);
            const blob = new Blob([fileContent], { type: file.mimeType });
            const fileObj = new File([blob], file.name, { type: file.mimeType });
            fileObjects.push(fileObj);
          }
          handleCarouselFilesChange({ target: { files: fileObjects } });
        } else {
          // Handle single file
          const file = files[0];
          const fileContent = await downloadGoogleDriveFile(file.id);
          const blob = new Blob([fileContent], { type: file.mimeType });
          const fileObj = new File([blob], file.name, { type: file.mimeType });
          
          if (filePickerType === 'photo') {
            handleImageChange({ target: { files: [fileObj] } });
          } else if (filePickerType === 'video') {
            handleReelFileChange({ target: { files: [fileObj] } });
          }
        }
        
        closeFilePicker();
        setMessage('File(s) selected from Google Drive successfully!');
      } catch (error) {
        console.error('Error downloading file from Google Drive:', error);
        setMessage('Failed to download file from Google Drive: ' + error.message);
      }
    }
  };

  const downloadGoogleDriveFile = async (fileId) => {
    try {
      const response = await apiClient.downloadGoogleDriveFile(fileId);
      if (response.success && response.fileContent) {
        // Convert base64 to blob
        const byteCharacters = atob(response.fileContent);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return byteArray;
      } else {
        throw new Error(response.error || 'Download failed');
      }
    } catch (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }
  };

  // --- Post Submission ---
  const handlePublish = async () => {
    if (!selectedAccount) {
      setMessage('Please select an Instagram account first');
      return;
    }

    if (postType === 'photo') {
      const hasAiImage = aiImageUrl && aiImageUrl.trim();
      const hasUploadedImage = uploadedImageUrl && uploadedImageUrl.trim();
      const hasImage = hasAiImage || hasUploadedImage;
      
      console.log('🔍 DEBUG: Photo post validation:', {
        aiImageUrl,
        uploadedImageUrl,
        hasAiImage,
        hasUploadedImage,
        hasImage
      });
      
      if (!hasImage) {
        setMessage('Please select or generate an image before creating a photo post');
        return;
      }
    }

    if (postType === 'carousel' && carouselImages.length === 0) {
      setMessage('Please generate or upload carousel images');
      return;
    }

    if (postType === 'reel' && !reelUrl) {
      setMessage('Please upload a video for the reel');
      return;
    }

    setLoading(true);
    setMessage('Creating Instagram post...');

    try {
      // Use the unified Instagram post endpoint for all post types
      const options = {
        instagram_user_id: selectedAccount.id,
        post_type: postType === 'photo' ? 'feed' : postType,
        media_type: postType === 'reel' ? 'video' : 'image'
      };

      // Handle different post types
      if (postType === 'photo') {
        options.caption = caption;
        const imageUrl = imageSource === 'ai' ? aiImageUrl : uploadedImageUrl;
        console.log('🔍 DEBUG: Photo post preparation:', {
          postType,
          imageSource,
          aiImageUrl,
          uploadedImageUrl,
          selectedImageUrl: imageUrl,
          hasImageUrl: !!(imageUrl && imageUrl.trim())
        });
        
        if (imageUrl && imageUrl.trim()) {
          options.image_url = imageUrl;
          console.log('🔍 DEBUG: Set image_url in options:', imageUrl);
        } else {
          // If no image is available, we can't create a photo post
          setMessage('Please select or generate an image before creating a photo post');
          setLoading(false);
          return;
        }
        
        // Double-check that we have an image URL
        if (!options.image_url || !options.image_url.trim()) {
          setMessage('No valid image URL found. Please select or generate an image first.');
          setLoading(false);
          return;
        }
        
        console.log('🔍 DEBUG: Photo post options:', {
          postType,
          imageSource,
          aiImageUrl,
          uploadedImageUrl,
          finalImageUrl: options.image_url,
          caption: options.caption
        });
      } else if (postType === 'carousel') {
        // For carousel, we need to use the carousel-specific endpoint
        const response = await apiClient.postInstagramCarousel(
          selectedAccount.id,
          carouselCaption,
          carouselImages
        );
        
        if (response.success) {
          setMessage('Instagram carousel post created successfully!');
          // Reset form
          setCarouselImages([]);
          setCarouselCaption('');
          setCaptionPrompt('');
          setAutoGenerateCaption(false);
          setAiPrompt('');
          
          // Reload user media
          if (selectedAccount) {
            loadUserMedia(selectedAccount.id);
          }
        } else {
          setMessage(`Failed to create carousel post: ${response.error}`);
        }
        setLoading(false);
        return;
      } else if (postType === 'reel') {
        options.caption = reelCaption;
        options.video_url = reelUrl;
      }

      // Remove any empty string values from options to avoid backend validation issues
      const cleanOptions = Object.fromEntries(
        Object.entries(options).filter(([key, value]) => 
          value !== null && value !== undefined && value !== ''
        )
      );
      
      console.log('🔍 DEBUG: Original options:', options);
      console.log('🔍 DEBUG: Cleaned options:', cleanOptions);
      
      // Additional validation for photo posts
      if (postType === 'photo') {
        if (!cleanOptions.image_url) {
          setMessage('Photo posts require an image. Please select or generate an image first.');
          setLoading(false);
          return;
        }
        
        // Validate that the image URL is not empty
        if (!cleanOptions.image_url.trim()) {
          setMessage('Invalid image URL. Please select or generate an image first.');
          setLoading(false);
          return;
        }
        
        console.log('🔍 DEBUG: Final validation passed - image_url:', cleanOptions.image_url);
      }
      
      console.log('🔍 DEBUG: Calling createUnifiedInstagramPost with:', {
        instagramUserId: selectedAccount.id,
        options: cleanOptions
      });
      const response = await apiClient.createUnifiedInstagramPost(selectedAccount.id, cleanOptions);
      
      if (response.success) {
        setMessage('Instagram post created successfully!');
        // Reset form
        setCaption('');
        setReelCaption('');
        setReelCaptionPrompt('');
        setReelAutoGenerateCaption(false);
        setAiImageUrl('');
        setUploadedImageUrl('');
        setReelUrl('');
        setReelFile(null);
        setSelectedImageFile(null);
        setAiPrompt('');
        setCaptionPrompt('');
        
        // Reload user media
        if (selectedAccount) {
          loadUserMedia(selectedAccount.id);
        }
      } else {
        setMessage(`Failed to create post: ${response.error}`);
      }
    } catch (error) {
      console.error('Error creating Instagram post:', error);
      setMessage(`Error creating post: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Check Google Drive availability
  const checkGoogleDriveAvailability = async () => {
    try {
      const status = await apiClient.getGoogleDriveStatus();
      setGoogleDriveAvailable(status.authenticated);
    } catch (error) {
      console.error('Error checking Google Drive availability:', error);
      setGoogleDriveAvailable(false);
    }
  };

  // --- Logout ---
  const handleLogout = () => {
    if (window.FB) {
      window.FB.logout(() => {
        setIsConnected(false);
        setInstagramAccounts([]);
        setSelectedAccount('');
        setFbAccessToken(null);
        setUserMedia([]);
        setActiveTab('connect');
        setMessage('Logged out successfully');
      });
    }
  };

  // --- UI Render ---
  if (authLoading) {
    return <div className="instagram-container"><div className="loading-screen"><div className="loading-spinner"></div><p>Checking authentication...</p></div></div>;
  }
  if (!isAuthenticated) {
    return (
      <div className="instagram-container">
        <div className="header-section">
          <button onClick={() => navigate('/')} className="back-button">Back to Dashboard</button>
          <h1>Instagram Management</h1>
          <p>Please log in to your account to connect and manage Instagram.</p>
        </div>
        <div className="auth-required">
          <div className="auth-icon"></div>
          <h2>Authentication Required</h2>
          <p>You need to be logged in to use Instagram features. Please log in first.</p>
        </div>
      </div>
    );
  }
  if (!sdkLoaded) {
    return <div className="instagram-container"><div className="loading-screen"><div className="loading-spinner"></div><p>Loading Instagram SDK...</p></div></div>;
  }

  return (
    <div className="instagram-container">
      <div className="header-section">
        <button onClick={() => navigate('/')} className="back-button">Back to Dashboard</button>
        <div className="header-content">
          <div className="header-icon"></div>
          <div className="header-text">
            <h1>Instagram Management</h1>
            <p>Connect and manage your Instagram Business accounts</p>
          </div>
        </div>
      </div>
      {message && <div className="status-message info"><span className="message-text">{message}</span></div>}
      <div className="main-content">
        <div className="tab-navigation">
          <button className={`tab-button ${activeTab === 'connect' ? 'active' : ''}`} onClick={() => setActiveTab('connect')}>Connect Account</button>
          <button className={`tab-button ${activeTab === 'post' ? 'active' : ''}`} onClick={() => setActiveTab('post')} disabled={!isConnected}>Create Post</button>
          <button className={`tab-button ${activeTab === 'media' ? 'active' : ''}`} onClick={() => setActiveTab('media')} disabled={!isConnected || !selectedAccount}>Media Gallery</button>
        </div>
        <div className="tab-content">
          {activeTab === 'connect' && (
            <div className="connect-section">
              {!isConnected ? (
                <div className="connection-card">
                  <div className="connection-icon"></div>
                  <h2>Connect Instagram Account</h2>
                  <p>Connect your Instagram Business account through Facebook to start posting and managing content.</p>
                  <button onClick={handleFacebookLogin} disabled={loading} className="connect-main-button">{loading ? 'Connecting...' : 'Connect via Facebook'}</button>
                  <div className="requirements-card">
                    <h3>Requirements</h3>
                    <ul>
                      <li>Instagram Business or Creator account</li>
                      <li>Connected to a Facebook Page</li>
                      <li>Admin access to the Facebook Page</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="connected-accounts">
                  <div className="accounts-header">
                    <h2>Connected Instagram Accounts</h2>
                    <button onClick={handleLogout} className="logout-button">Disconnect</button>
                  </div>
                  <div className="accounts-grid">
                    {instagramAccounts.map(account => (
                      <div key={account.id} className={`account-card ${selectedAccount.id === account.id ? 'selected' : ''}`} onClick={() => setSelectedAccount(account)}>
                        <div className="account-avatar">{account.profile_picture_url ? <img src={account.profile_picture_url} alt={account.username} /> : <div className="avatar-placeholder"></div>}</div>
                        <div className="account-info">
                          <h3>@{account.username}</h3>
                          <p>{account.name}</p>
                          <div className="account-stats"><span>{account.followers_count} followers</span><span>{account.media_count} posts</span></div>
                          </div>
                        {selectedAccount.id === account.id && <div className="selected-indicator"></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'post' && selectedAccount && (
            <div className="post-section">
              <div className="post-type-toggle">
                <button className={postType === 'photo' ? 'active' : ''} onClick={() => setPostType('photo')}>Photo</button>
                <button className={postType === 'carousel' ? 'active' : ''} onClick={() => setPostType('carousel')}>Carousel</button>
                <button className={postType === 'reel' ? 'active' : ''} onClick={() => setPostType('reel')}>Reel</button>
              </div>
              {/* Photo Post */}
              {postType === 'photo' && (
              <div className="post-card">
                  <div className="form-group">
                    <label>Image Source</label>
                    <div className="image-source-toggle">
                      <button className={imageSource === 'ai' ? 'active' : ''} onClick={() => setImageSource('ai')}>AI</button>
                      <button className={imageSource === 'upload' ? 'active' : ''} onClick={() => setImageSource('upload')}>Upload</button>
                </div>
                  </div>
                  {imageSource === 'ai' && (
                  <div className="form-group">
                      <label>AI Prompt</label>
                    <textarea
                        value={aiPrompt} 
                        onChange={e => {
                          setAiPrompt(e.target.value);
                          // Clear generated content when prompt changes
                          if (aiImageUrl) {
                            setAiImageUrl('');
                          }
                          if (caption && !caption.trim().includes('Check out this amazing image!')) {
                            setCaption('');
                          }
                        }} 
                        placeholder="Describe your image..." 
                        rows={3} 
                      className="post-textarea"
                    />
                      <div className="ai-buttons">
                        <button className="ai-generate-button" onClick={handleGenerateAIImage} disabled={aiGenerating || !aiPrompt.trim() || rateLimitCooldown > 0}>
                          {aiGenerating ? 'Generating...' : 'Generate Image'}
                        </button>
                        <button className="ai-generate-button secondary" onClick={handleGenerateImageAndCaption} disabled={aiGenerating || generatingCaption || !aiPrompt.trim() || rateLimitCooldown > 0}>
                          {aiGenerating || generatingCaption ? 'Generating...' : 'Generate Image & Caption'}
                        </button>
                        {message && message.includes('Error') && aiPrompt.trim() && (
                          <button className="ai-generate-button retry" onClick={handleRetryImageGeneration} disabled={aiGenerating || rateLimitCooldown > 0}>
                            {aiGenerating ? 'Retrying...' : 'Retry Generation'}
                          </button>
                        )}
                  </div>
                      {rateLimitCooldown > 0 && (
                        <div style={{ color: '#e53e3e', marginTop: 8, fontWeight: 500 }}>
                          Too many requests. Please wait {Math.floor(rateLimitCooldown / 60)}:{(rateLimitCooldown % 60).toString().padStart(2, '0')} before trying again.
                        </div>
                      )}
                    </div>
                  )}
                  {imageSource === 'upload' && (
                    <div className="form-group image-upload">
                      <label>Select Image</label>
                      <button 
                        type="button" 
                        onClick={() => openFilePicker('photo', 'manual')} 
                        className="file-picker-button"
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? 'Uploading...' : 'Choose Image'}
                      </button>
                      {uploadedImageUrl && (
                        <div className="image-preview">
                          <img src={uploadedImageUrl} alt="Preview" className="preview-image" />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="form-group">
                    <label>Caption</label>
                    <div className="caption-section">
                      <div className="caption-toggle">
                        <label className="toggle-label">
                      <input
                            type="checkbox" 
                            checked={autoGenerateCaption} 
                            onChange={e => setAutoGenerateCaption(e.target.checked)}
                          />
                          <span className="toggle-text">Auto Generate Caption</span>
                      </label>
                      </div>
                      {autoGenerateCaption ? (
                        <div className="caption-prompt-section">
                          <textarea 
                            value={captionPrompt} 
                            onChange={e => setCaptionPrompt(e.target.value)} 
                            placeholder="Describe what you want in the caption..." 
                            rows={2} 
                            className="caption-prompt-textarea" 
                          />
                          <button 
                            onClick={handleAutoGenerateCaption} 
                            disabled={generatingCaption || !captionPrompt.trim()} 
                            className="generate-caption-button"
                          >
                            {generatingCaption ? 'Generating...' : 'Generate Caption'}
                          </button>
                        </div>
                      ) : null}
                      <textarea 
                        value={caption} 
                        onChange={e => setCaption(e.target.value)} 
                        placeholder={autoGenerateCaption ? "Caption will be generated..." : "Write your caption..."} 
                        rows={3} 
                        className="post-textarea" 
                        disabled={autoGenerateCaption}
                      />
                    </div>
                  </div>
                  {(aiImageUrl || uploadedImageUrl) && <div className="generated-image"><img src={aiImageUrl || uploadedImageUrl} alt="Preview" /></div>}
                  <button className="publish-button" onClick={handlePublish} disabled={loading || !(aiImageUrl || uploadedImageUrl) || (!caption.trim() && !autoGenerateCaption)}>{loading ? 'Publishing...' : 'Publish Post'}</button>
                </div>
              )}
              {/* Carousel Post */}
              {postType === 'carousel' && (
                <div className="post-card">
                  <div className="form-group">
                    <label>Carousel Mode</label>
                    <div className="image-source-toggle">
                      <button 
                        className={imageSource === 'ai' ? 'active' : ''} 
                        onClick={() => setImageSource('ai')}
                        disabled={carouselGenerating}
                      >
                        🤖 AI Generation
                      </button>
                      <button 
                        className={imageSource === 'upload' ? 'active' : ''} 
                        onClick={() => setImageSource('upload')}
                        disabled={carouselGenerating}
                      >
                        📤 Manual Upload
                      </button>
                    </div>
                  </div>

                  {/* Image Count Selector */}
                  <div className="form-group">
                    <label>Number of Images: {carouselCount}</label>
                    <input
                      type="range"
                      min="3"
                      max="7"
                      value={carouselCount}
                      onChange={(e) => setCarouselCount(parseInt(e.target.value))}
                      className="slider"
                      disabled={carouselGenerating}
                    />
                    <div className="slider-labels">
                      <span>3</span>
                      <span>4</span>
                      <span>5</span>
                      <span>6</span>
                      <span>7</span>
                    </div>
                  </div>

                  {/* AI Generation Mode */}
                  {imageSource === 'ai' && (
                    <div className="form-group">
                      <label>AI Prompt for Carousel</label>
                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Describe the carousel content you want to generate..."
                        rows="3"
                        className="post-textarea"
                        disabled={carouselGenerating}
                      />
                      <div className="ai-generation-note">
                        <small>💡 Tip: Carousel generation takes 3-5 minutes for {carouselCount} images. Please be patient!</small>
                      </div>
                      <button 
                        className="generate-button"
                        onClick={async () => {
                          if (!aiPrompt.trim()) {
                            setMessage('Please enter a prompt for carousel generation.');
                            return;
                          }
                          setCarouselGenerating(true);
                          setMessage(`Generating ${carouselCount} carousel images with AI... This may take 3-5 minutes.`);
                          try {
                            const response = await apiClient.generateInstagramCarousel(aiPrompt.trim(), carouselCount);
                            if (response && response.success && response.image_urls) {
                              setCarouselImages(response.image_urls);
                              setCarouselCaption(response.caption || '');
                              setMessage(`AI carousel generated successfully with ${response.image_urls.length} images!`);
                            } else {
                              setMessage(response.error || 'Failed to generate carousel images.');
                            }
                          } catch (error) {
                            console.error('Carousel generation error:', error);
                            if (error.message && error.message.includes('timeout')) {
                              setMessage('Carousel generation timed out. This can happen with complex prompts or when generating many images. Please try again with a simpler prompt or fewer images.');
                            } else {
                              setMessage('Error generating carousel: ' + (error.message || error.toString()));
                            }
                          } finally {
                            setCarouselGenerating(false);
                          }
                        }}
                        disabled={carouselGenerating || !aiPrompt.trim()}
                      >
                        {carouselGenerating ? (
                      <>
                        <div className="button-spinner"></div>
                            Generating {carouselCount} Images...
                      </>
                    ) : (
                      <>
                            <span role="img" aria-label="Generate">✨</span> Generate Carousel
                      </>
                    )}
                  </button>
                </div>
                  )}

                                    {/* Manual Upload Mode */}
                  {imageSource === 'upload' && (
                    <div className="form-group">
                      <label>Upload Images (JPG/PNG)</label>
                      <button 
                        type="button" 
                        onClick={() => openFilePicker('photo', 'carousel')} 
                        className="file-picker-button"
                        disabled={carouselGenerating}
                      >
                        {carouselGenerating ? (
                          <>
                            <div className="button-spinner"></div>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <span role="img" aria-label="Upload">📤</span> Select {carouselCount} Images
                          </>
                        )}
                      </button>
                      <p className="file-upload-hint">
                        Select {carouselCount} images for your carousel
                      </p>
                    </div>
                  )}

                  {/* Caption Generation */}
                  <div className="form-group">
                    <label>Caption</label>
                    <div className="caption-section">
                      <div className="caption-toggle">
                        <label className="toggle-label">
                          <input 
                            type="checkbox" 
                            checked={autoGenerateCaption} 
                            onChange={e => setAutoGenerateCaption(e.target.checked)}
                          />
                          <span className="toggle-text">Auto Generate Caption</span>
                        </label>
                      </div>
                      {autoGenerateCaption ? (
                        <div className="caption-prompt-section">
                          <textarea 
                            value={captionPrompt} 
                            onChange={e => setCaptionPrompt(e.target.value)} 
                            placeholder="Describe what you want in the caption..." 
                            rows={2} 
                            className="caption-prompt-textarea" 
                          />
                          <button 
                            onClick={handleCarouselAutoGenerateCaption} 
                            disabled={generatingCaption || !captionPrompt.trim()} 
                            className="generate-caption-button"
                          >
                            {generatingCaption ? 'Generating...' : 'Generate Caption'}
                          </button>
                        </div>
                      ) : null}
                      <textarea 
                        value={carouselCaption} 
                        onChange={e => setCarouselCaption(e.target.value)} 
                        placeholder={autoGenerateCaption ? "Caption will be generated..." : "Write your caption..."} 
                        rows={3} 
                        className="post-textarea" 
                        disabled={autoGenerateCaption}
                      />
                    </div>
                  </div>

                  {/* Carousel Preview */}
                  {carouselImages.length > 0 && (
                    <div className="carousel-preview-section">
                      <h4>Carousel Preview</h4>
                      <div className="carousel-preview-grid">
                        {carouselImages.slice(0, carouselCount).map((url, index) => (
                          <div key={index} className="carousel-preview-item">
                            <img src={url} alt={`Carousel item ${index + 1}`} />
                            <span className="carousel-item-number">{index + 1}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button 
                    className="publish-button" 
                    onClick={async () => {
                      if (!selectedAccount) {
                        setMessage('Please select an Instagram account first.');
                        return;
                      }
                      if (carouselImages.length < 3) {
                        setMessage('Please add at least 3 images for carousel.');
                        return;
                      }
                      if (!carouselCaption.trim() && !autoGenerateCaption) {
                        setMessage('Please write a caption or enable auto-generate caption.');
                        return;
                      }
                      if (autoGenerateCaption && !captionPrompt.trim()) {
                        setMessage('Please provide a prompt for auto-generating caption.');
                        return;
                      }
                      
                      setLoading(true);
                      setMessage('Publishing carousel post...');
                      try {
                        console.log('🔍 DEBUG: Carousel publish - selectedAccount:', selectedAccount);
                        console.log('🔍 DEBUG: Carousel publish - carouselImages:', carouselImages);
                        console.log('🔍 DEBUG: Carousel publish - carouselCount:', carouselCount);
                        
                        const finalCaption = autoGenerateCaption && captionPrompt.trim() ? 
                          await (async () => {
                            const res = await apiClient.generateInstagramCaption(captionPrompt.trim());
                            return res.content || carouselCaption || 'Check out this amazing carousel!';
                          })() : carouselCaption;
                        
                        console.log('🔍 DEBUG: Carousel publish - finalCaption:', finalCaption);
                        
                        const response = await apiClient.postInstagramCarousel(
                          selectedAccount.id, 
                          finalCaption, 
                          carouselImages.slice(0, carouselCount)
                        );
                        
                        if (response.success) {
                          setMessage('Carousel post published successfully!');
                          setCarouselImages([]);
                          setCarouselCaption('');
                          setCaptionPrompt('');
                          setAutoGenerateCaption(false);
                          setAiPrompt('');
                          loadUserMedia(selectedAccount.id);
                        } else {
                          setMessage('Failed to publish carousel: ' + (response.error || 'Unknown error'));
                        }
                      } catch (err) {
                        setMessage('Error publishing carousel: ' + (err.message || err.toString()));
                      } finally {
                        setLoading(false);
                      }
                    }} 
                    disabled={loading || carouselImages.length < 3 || (!carouselCaption.trim() && !autoGenerateCaption)}
                  >
                    {loading ? 'Publishing...' : 'Publish Carousel'}
                  </button>
                </div>
              )}
              {/* Reel Post */}
              {postType === 'reel' && (
                <div className="post-card">
                  <div className="form-group">
                    <label>Upload Reel Video (.mp4)</label>
                    <button 
                      type="button" 
                      onClick={() => openFilePicker('video', 'manual')} 
                      className="file-picker-button"
                      disabled={reelUploading}
                    >
                      {reelUploading ? 'Uploading...' : 'Choose Video'}
                    </button>
                    {reelUrl && (
                      <div className="video-preview">
                        <video src={reelUrl} controls style={{ width: '100%', maxHeight: '300px' }} />
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Caption</label>
                    <div className="caption-section">
                      <div className="caption-toggle">
                        <label className="toggle-label">
                          <input 
                            type="checkbox" 
                            checked={reelAutoGenerateCaption} 
                            onChange={e => setReelAutoGenerateCaption(e.target.checked)}
                          />
                          <span className="toggle-text">Auto Generate Caption</span>
                        </label>
                      </div>
                      {reelAutoGenerateCaption ? (
                        <div className="caption-prompt-section">
                          <textarea 
                            value={reelCaptionPrompt} 
                            onChange={e => setReelCaptionPrompt(e.target.value)} 
                            placeholder="Describe what you want in the caption..." 
                            rows={2} 
                            className="caption-prompt-textarea" 
                          />
                          <button 
                            onClick={handleReelAutoGenerateCaption} 
                            disabled={generatingReelCaption || !reelCaptionPrompt.trim()} 
                            className="generate-caption-button"
                          >
                            {generatingReelCaption ? 'Generating...' : 'Generate Caption'}
                          </button>
                        </div>
                      ) : null}
                      <textarea 
                        value={reelCaption} 
                        onChange={e => setReelCaption(e.target.value)} 
                        placeholder={reelAutoGenerateCaption ? "Caption will be generated..." : "Write your caption..."} 
                        rows={3} 
                        className="post-textarea" 
                        disabled={reelAutoGenerateCaption}
                      />
                    </div>
                  </div>
                  <button className="publish-button" onClick={handlePublish} disabled={loading || !reelUrl || (!reelCaption.trim() && !reelAutoGenerateCaption)}>{loading ? 'Publishing...' : 'Publish Reel'}</button>
                </div>
              )}
            </div>
          )}
          {activeTab === 'media' && selectedAccount && (
            <div className="media-section">
              <div className="media-header"><h2>Recent Posts</h2><p>Your latest Instagram content</p></div>
              {loadingMedia ? <div className="loading-media"><div className="loading-spinner"></div><p>Loading media...</p></div> : userMedia.length > 0 ? <div className="media-grid">{userMedia.slice(0, 12).map((media) => <div key={media.id} className="media-item"><div className="media-content">{media.media_type === 'IMAGE' ? <img src={media.media_url} alt="Instagram post" /> : media.media_type === 'VIDEO' ? <video controls><source src={media.media_url} type="video/mp4" /></video> : null}</div><div className="media-overlay"><div className="media-info"><p className="media-caption">{media.caption ? media.caption.substring(0, 100) + '...' : 'No caption'}</p><p className="media-date">{new Date(media.timestamp).toLocaleDateString()}</p></div></div></div>)}</div> : <div className="no-media"><h3>No Media Found</h3><p>No media found for this account. Start creating posts to see them here!</p></div>}
            </div>
          )}
        </div>
              </div>
              
      {/* Google Drive Modal */}
      {showDriveModal && (
        <div className="modal-overlay" onClick={() => setShowDriveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select from Google Drive</h3>
              <button onClick={() => setShowDriveModal(false)} className="modal-close">&times;</button>
                </div>
            <div className="modal-body">
              {!driveAuthenticated ? (
                <div className="drive-auth">
                  <p>Connect to Google Drive to select files</p>
                  <button onClick={authenticateGoogleDrive} disabled={driveAuthLoading} className="auth-button">
                    {driveAuthLoading ? 'Connecting...' : 'Connect Google Drive'}
                  </button>
                      </div>
              ) : (
                <div className="drive-files">
                  {loadingDriveFiles ? (
                    <div className="loading-files">
                      <div className="loading-spinner"></div>
                      <p>Loading files...</p>
                        </div>
                  ) : driveFiles.length > 0 ? (
                    <div className="files-grid">
                      {driveFiles.map((file) => (
                        <div key={file.id} className="file-item" onClick={() => handleDriveFileSelect(file.id, file.name)}>
                          {file.thumbnailLink ? (
                            <img src={file.thumbnailLink} alt={file.name} className="file-thumbnail" />
                          ) : (
                            <div className="file-icon"></div>
                          )}
                          <div className="file-info">
                            <p className="file-name">{file.name}</p>
                            <p className="file-size">{file.size ? `${Math.round(file.size / 1024)} KB` : 'Unknown size'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                    <div className="no-files">
                      <p>No image files found in Google Drive</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
        </div>
      )}

      {/* File Picker Modal */}
      {showFilePicker && (
        <div className="modal-overlay" onClick={closeFilePicker}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select {filePickerType === 'photo' ? 'Photo' : 'Video'}</h3>
              <button onClick={closeFilePicker} className="modal-close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="file-picker-options">
                <div 
                  className="file-option" 
                  onClick={() => document.getElementById('local-file-input').click()}
                  onTouchStart={(e) => e.preventDefault()}
                >
                  <div className="file-option-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10,9 9,9 8,9"/>
                    </svg>
                  </div>
                  <div className="file-option-content">
                    <h4>From Device</h4>
                    <p>Select a file from your computer</p>
                  </div>
                </div>
                
                <div 
                  className={`file-option ${!googleDriveAvailable ? 'disabled' : ''}`} 
                  onClick={handleGoogleDriveSelect}
                  onTouchStart={(e) => {
                    if (!googleDriveAvailable) {
                      e.preventDefault();
                      return;
                    }
                    e.preventDefault();
                    handleGoogleDriveSelect();
                  }}
                >
                  <div className="file-option-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9,22 9,12 15,12 15,22"/>
                    </svg>
                  </div>
                  <div className="file-option-content">
                    <h4>From Google Drive</h4>
                    <p>
                      {googleDriveAvailable 
                        ? 'Select a file from your Google Drive' 
                        : 'Google Drive not configured. See setup guide.'
                      }
                    </p>
                    {isLoadingGoogleDrive && (
                      <div className="loading-indicator">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 11-6.219-8.56"/>
                        </svg>
                        Loading...
                      </div>
                    )}
                    {!googleDriveAvailable && (
                      <div className="unavailable-indicator">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="15" y1="9" x2="9" y2="15"/>
                          <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        Not Available
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Hidden file input for local file selection */}
              <input
                id="local-file-input"
                type="file"
                accept={filePickerType === 'photo' ? 'image/*' : 'video/*'}
                multiple={filePickerFormType === 'carousel'}
                onChange={handleLocalFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstagramPage; 