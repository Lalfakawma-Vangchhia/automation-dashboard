import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import './InstagramPage.css';


const InstagramPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [instagramAccounts, setInstagramAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [fbAccessToken, setFbAccessToken] = useState(null);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [userMedia, setUserMedia] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [activeTab, setActiveTab] = useState('connect');
  const [postType, setPostType] = useState('photo');
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [imageSource, setImageSource] = useState('ai');
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [reelVideo, setReelVideo] = useState(null);
  const [carouselCount, setCarouselCount] = useState(3);
  const [carouselAIGenerating, setCarouselAIGenerating] = useState(false);
  const [carouselAIImages, setCarouselAIImages] = useState([]);
  const [selectedPostType, setSelectedPostType] = useState('photo');
  
  // Carousel specific states
  const [carouselMode, setCarouselMode] = useState('ai'); // 'ai' or 'upload'
  const [carouselImageCount, setCarouselImageCount] = useState(3);
  const [carouselPrompt, setCarouselPrompt] = useState('');
  const [carouselImages, setCarouselImages] = useState([]);
  const [uploadedCarouselImages, setUploadedCarouselImages] = useState([]);
  const [carouselCaption, setCarouselCaption] = useState('');
  const [isGeneratingCarousel, setIsGeneratingCarousel] = useState(false);
  const [isUploadingCarousel, setIsUploadingCarousel] = useState(false);
  const [carouselFiles, setCarouselFiles] = useState([]);
  const [isPublishingCarousel, setIsPublishingCarousel] = useState(false);

  // Add Reel Post UI state
  const [reelPrompt, setReelPrompt] = useState('');
  const [generatingReel, setGeneratingReel] = useState(false);
  const [reelVideoUrl, setReelVideoUrl] = useState(null);
  const [reelCaption, setReelCaption] = useState('');
  const [generatingReelCaption, setGeneratingReelCaption] = useState(false);
  const [publishingReel, setPublishingReel] = useState(false);
  const [reelCaptionPrompt, setReelCaptionPrompt] = useState('');

  // Add state for Reel upload mode
  const [reelMode, setReelMode] = useState('ai'); // 'ai' or 'upload'
  const [uploadedReelFile, setUploadedReelFile] = useState(null);
  const [uploadedReelUrl, setUploadedReelUrl] = useState(null);
  const [uploadingReel, setUploadingReel] = useState(false);

  // Instagram App ID (different from Facebook App ID)
  const INSTAGRAM_APP_ID = process.env.REACT_APP_INSTAGRAM_APP_ID || '24054495060908418';

  const [automationTabMedia, setAutomationTabMedia] = useState(null);
  const [automationTabAccount, setAutomationTabAccount] = useState('');
  const [automationTabSelectedMedia, setAutomationTabSelectedMedia] = useState(null);

  // Generate AI Carousel Images
  const handleGenerateAICarousel = async () => {
    if (!carouselPrompt.trim()) return;
    setIsGeneratingCarousel(true);
    setMessage('');
    try {
      // Use new backend endpoint
      const response = await apiClient.generateAICarousel(carouselPrompt, carouselImageCount);
      if (response && response.success && response.image_urls && response.image_urls.length > 0) {
        setCarouselImages(response.image_urls);
        setCarouselCaption(response.caption || '');
        setMessage('AI carousel generated! You can now review and publish.');
      } else {
        setMessage(response.error || 'Failed to generate carousel images. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error generating carousel:', error);
      setMessage(error.message || 'Failed to generate carousel. Please try again.', 'error');
    } finally {
      setIsGeneratingCarousel(false);
    }
  };

  // Handle carousel image uploads (upload mode)
  const handleCarouselImageUpload = async (files) => {
    if (!files || files.length < 3 || files.length > 7) {
      setMessage('Please select 3 to 7 images (JPG/PNG)', 'error');
      return;
    }
    setIsUploadingCarousel(true);
    setMessage('');
    try {
      // Use new backend endpoint for upload mode
      const response = await apiClient.uploadCarouselWithAI(Array.from(files), carouselPrompt);
      if (response && response.images && response.images.length > 0) {
        setUploadedCarouselImages(response.images);
        setCarouselCaption(response.caption || '');
        setMessage('Images uploaded and caption generated! You can now review and publish.');
      } else {
        setMessage('Failed to upload images or generate caption. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      setMessage(error.message || 'Failed to upload images. Please try again.', 'error');
    } finally {
      setIsUploadingCarousel(false);
    }
  };

  // Generate caption for carousel using AI
  const generateCarouselCaption = async (promptText) => {
    if (!promptText.trim()) return;
    
    try {
      const response = await apiClient.request('/api/ai/generate-caption', {
        method: 'POST',
        body: JSON.stringify({
          prompt: promptText,
          type: 'carousel',
          tone: 'engaging'
        })
      });
      
      if (response.data && response.data.caption) {
        setCarouselCaption(response.data.caption);
      } else {
        setMessage('Failed to generate caption. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error generating caption:', error);
      setMessage(error.response?.data?.message || 'Failed to generate caption. Please try again.', 'error');
    }
  };

  // Publish carousel post to Instagram
  const handlePublishCarousel = async () => {
    if (!selectedAccount) {
      setMessage('Please select an Instagram account first', 'error');
      return;
    }
    const images = carouselMode === 'ai' ? carouselImages : uploadedCarouselImages;
    if (images.length === 0) {
      setMessage('Please add images to your carousel', 'error');
      return;
    }
    if (!carouselCaption.trim()) {
      setMessage('Please add a caption to your carousel', 'error');
      return;
    }
    setIsPublishingCarousel(true);
    setMessage('Publishing carousel post...', 'info');
    try {
      // Use new helper for carousel publishing
      const response = await apiClient.publishInstagramCarousel(selectedAccount, carouselCaption, images.slice(0, carouselImageCount));
      if (response && response.success) {
        setMessage('Carousel post published successfully!', 'success');
        setCarouselImages([]);
        setUploadedCarouselImages([]);
        setCarouselCaption('');
        setCarouselPrompt('');
      } else {
        setMessage(response?.error || 'Failed to publish carousel. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error publishing carousel:', error);
      setMessage(error.message || 'Failed to publish carousel. Please try again later.', 'error');
    } finally {
      setIsPublishingCarousel(false);
    }
  };

  // Handler to generate AI Reel video
  const handleGenerateAIReel = async () => {
    if (!reelPrompt.trim()) {
      setMessage('Please enter a prompt for the video.');
      return;
    }
    setGeneratingReel(true);
    setMessage('Generating video with AI...');
    try {
      const response = await apiClient.generateAIReel(reelPrompt.trim());
      if (response && response.video_url) {
        setReelVideoUrl(response.video_url);
        setMessage('Video generated!');
      } else {
        setMessage(response?.error || 'Failed to generate video.');
      }
    } catch (err) {
      setMessage('Error: ' + (err.message || err.toString()));
    } finally {
      setGeneratingReel(false);
    }
  };

  // Handler to generate AI caption for Reel
  const handleGenerateReelCaption = async () => {
    if (!reelPrompt.trim()) {
      setMessage('Please enter a prompt for the caption.');
      return;
    }
    setGeneratingReelCaption(true);
    setMessage('Generating caption with AI...');
    try {
      const response = await apiClient.generateContent(reelPrompt.trim());
      if (response && response.content) {
        setReelCaption(response.content);
        setMessage('Caption generated!');
      } else {
        setMessage('Failed to generate caption.');
      }
    } catch (err) {
      setMessage('Error: ' + (err.message || err.toString()));
    } finally {
      setGeneratingReelCaption(false);
    }
  };

  // Handler to publish Reel
  const handlePublishReel = async () => {
    if (!selectedAccount) {
      setMessage('Please select an Instagram account first', 'error');
      return;
    }
    if (!reelVideoUrl) {
      setMessage('Please generate a video first.', 'error');
      return;
    }
    if (!reelCaption.trim()) {
      setMessage('Please add a caption to your Reel.', 'error');
      return;
    }
    setPublishingReel(true);
    setMessage('Publishing Reel...');
    try {
      const response = await apiClient.publishInstagramReel(selectedAccount, reelVideoUrl, reelCaption);
      if (response && response.success) {
        setMessage('Reel published successfully!', 'success');
        setReelPrompt('');
        setReelVideoUrl(null);
        setReelCaption('');
      } else {
        setMessage(response?.error || 'Failed to publish Reel.');
      }
    } catch (err) {
      setMessage('Error: ' + (err.message || err.toString()));
    } finally {
      setPublishingReel(false);
    }
  };

  // Handler for video upload
  const handleReelVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'video/mp4') {
      setMessage('Only .mp4 files are allowed.');
      return;
    }
    // Optionally, check duration/format client-side (if needed)
    setUploadingReel(true);
    setMessage('Uploading video...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Assume backend endpoint: /api/ai/upload-reel-video returns { url }
      const response = await apiClient.uploadReelVideo(formData);
      if (response && response.url) {
        setUploadedReelFile(file);
        setUploadedReelUrl(response.url);
        setMessage('Video uploaded!');
      } else {
        setMessage(response?.error || 'Failed to upload video.');
      }
    } catch (err) {
      setMessage('Error: ' + (err.message || err.toString()));
    } finally {
      setUploadingReel(false);
    }
  };

  // Handler to publish uploaded Reel
  const handlePublishUploadedReel = async () => {
    if (!selectedAccount) {
      setMessage('Please select an Instagram account first', 'error');
      return;
    }
    if (!uploadedReelUrl) {
      setMessage('Please upload a video first.', 'error');
      return;
    }
    if (!reelCaption.trim()) {
      setMessage('Please add a caption to your Reel.', 'error');
      return;
    }
    setPublishingReel(true);
    setMessage('Publishing Reel...');
    try {
      const response = await apiClient.publishInstagramReel(selectedAccount, uploadedReelUrl, reelCaption);
      if (response && response.success) {
        setMessage('Reel published successfully!', 'success');
        setUploadedReelFile(null);
        setUploadedReelUrl(null);
        setReelCaption('');
        setReelCaptionPrompt('');
      } else {
        setMessage(response?.error || 'Failed to publish Reel.');
      }
    } catch (err) {
      setMessage('Error: ' + (err.message || err.toString()));
    } finally {
      setPublishingReel(false);
    }
  };

  useEffect(() => {
    const checkLoginStatus = () => {
      if (!window.FB || !isAuthenticated) return;
      
      window.FB.getLoginStatus((response) => {
        if (response.status === 'connected') {
          setFbAccessToken(response.authResponse.accessToken);
          setMessage('Instagram: Using existing Facebook login session');
          // Auto-connect Instagram accounts if we have a token
          handleConnectInstagram(response.authResponse.accessToken);
        } else {
          setMessage('Instagram: Please connect your Facebook account to continue');
        }
      });
    };

    const initializeFacebookSDK = () => {
      // Always reinitialize with Instagram App ID to avoid conflicts
      if (window.FB) {
        // SDK already exists, reinitialize with Instagram App ID
        window.FB.init({
          appId: INSTAGRAM_APP_ID,
          cookie: true,
          xfbml: true,
          version: 'v18.0'
        });
        setSdkLoaded(true);
        checkLoginStatus();
        return;
      }

      // Load FB SDK for the first time
      window.fbAsyncInit = function() {
        window.FB.init({
          appId: INSTAGRAM_APP_ID,
          cookie: true,
          xfbml: true,
          version: 'v18.0'
        });
        setSdkLoaded(true);
        checkLoginStatus();
      };

      // Load the SDK script
      (function(d, s, id) {
        var js, fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) return;
        js = d.createElement(s); js.id = id;
        js.src = "https://connect.facebook.net/en_US/sdk.js";
        fjs.parentNode.insertBefore(js, fjs);
      }(document, 'script', 'facebook-jssdk'));
    };

    initializeFacebookSDK();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [INSTAGRAM_APP_ID, isAuthenticated]);

  // loadUserMedia function is defined later in the file

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
        // Map the backend response to match our frontend expectations
        const mappedAccounts = response.data.accounts.map(account => ({
          id: account.id, // Use DB id
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
        
        // Auto-select first account if only one
        if (mappedAccounts.length === 1) {
          setSelectedAccount(mappedAccounts[0].id);
          loadUserMedia(mappedAccounts[0].id);
        }
      } else {
        setMessage('No Instagram Business accounts found. Make sure you have an Instagram Business account connected to your Facebook Page.');
      }
    } catch (error) {
      console.error('Instagram connection error:', error);
      
      // Extract and display error message
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Handle various error object formats
        errorMessage = error.message || error.detail || error.error || JSON.stringify(error);
      }
      
      // Display error with proper formatting for troubleshooting steps
      setMessage(errorMessage);
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

    // Instagram requires specific permissions
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

  const handleGenerateAIPost = async () => {
    if (!selectedAccount) {
      setMessage('Please select an Instagram account first');
      return;
    }

    setGeneratingAI(true);
    setMessage('Generating AI post...');

    try {
      const response = await apiClient.createInstagramPost({
        instagram_user_id: selectedAccount,
        use_ai: true,
        prompt: 'Create an engaging Instagram post',
        post_type: 'post-auto'
      });

      if (response.success) {
        setPostContent(response.data?.generated_caption || response.ai_content || '');
        setMessage('AI post generated successfully!');
      } else {
        setMessage(`Failed to generate AI post: ${response.error}`);
      }
    } catch (error) {
      console.error('AI generation error:', error);
      setMessage(`Error generating AI post: ${error.message || 'Unknown error'}`);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleGenerateAIContent = async () => {
    if (!selectedAccount || !prompt.trim()) {
      setMessage('Please select an account and enter a prompt');
      return;
    }

    setGeneratingContent(true);
    setMessage('Generating AI content... This may take up to 60 seconds.');

    try {
      const response = await apiClient.createAIPost({
        prompt: prompt.trim()
      }, imageSource === 'ai');

      if (response.success) {
        setPostContent(response.content || '');
        if (response.image_url) {
          setGeneratedImage(response.image_url);
        }
        setMessage('AI content generated successfully!');
      } else {
        setMessage(`Failed to generate AI content: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('AI content generation error:', error);
      let errorMessage = error.message || 'Unknown error';
      
      // Handle specific error cases
      if (error.message?.includes('timeout') || error.message?.includes('longer than expected')) {
        errorMessage = 'AI content generation is taking longer than expected. Please try again with a shorter prompt.';
      } else if (error.message?.includes('not found')) {
        errorMessage = 'Instagram account not found. Please reconnect your account.';
      } else if (error.message?.includes('access token')) {
        errorMessage = 'Session expired. Please reconnect your Instagram account.';
      }
      
      setMessage(`Error generating AI content: ${errorMessage}`);
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleCreatePost = async () => {
    if (!selectedAccount || !postContent.trim()) {
      setMessage('Please select an account and enter post content');
      return;
    }
    setLoading(true);
    setMessage('Creating Instagram post...');
    try {
      let payload = {
        instagram_user_id: selectedAccount,
        caption: postContent,
        post_type: postType,
      };
      if (postType === 'photo') {
        payload.image_url = imageSource === 'ai' ? generatedImage : uploadedImageUrl;
      } else if (postType === 'carousel') {
        let urls = [];
        if (imageSource === 'upload') {
          for (let file of carouselImages) {
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result.split(',')[1]);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            const formData = new FormData();
            formData.append('key', 'a772916e3946785b60e598bf5d4f09fe');
            formData.append('image', base64);
            const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data && data.success) {
              urls.push(data.data.url);
            }
          }
        } else if (imageSource === 'ai') {
          urls = carouselAIImages;
        }
        payload.media_urls = urls;
      } else if (postType === 'reel') {
        if (reelVideo) {
          const formData = new FormData();
          formData.append('file', reelVideo);
          formData.append('upload_preset', 'automation');
          const res = await fetch('https://api.cloudinary.com/v1_1/duwnkbcpn/video/upload', { method: 'POST', body: formData });
          const data = await res.json();
          payload.video_url = data.secure_url;
        } else {
          setMessage('Please upload a video for the reel.');
          setLoading(false);
          return;
        }
      }
      const response = await apiClient.createInstagramPost(payload);
      if (response.success) {
        setMessage('Instagram post created successfully!');
        setPostContent('');
        setPostImage(null);
        setGeneratedImage(null);
        setUploadedImageUrl(null);
        setCarouselImages([]);
        setReelVideo(null);
        if (selectedAccount) {
          loadUserMedia(selectedAccount);
        }
      } else {
        setMessage(`Failed to create post: ${response.error}`);
      }
    } catch (error) {
      setMessage(`Error creating post: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadUserMedia = async (instagramUserId) => {
    if (!instagramUserId) return;
    setLoadingMedia(true);
    try {
      const response = await apiClient.request(`/api/media?social_account_id=${instagramUserId}`, { method: 'GET' });
      setUserMedia((response.media) || []);
    } catch (error) {
      console.error('Error loading media:', error);
      setMessage(`Error loading media: ${error.message}`, 'error');
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleAccountChange = (accountId) => {
    setSelectedAccount(accountId);
    if (accountId) {
      loadUserMedia(accountId);
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setMessage('Please select a PNG or JPG image');
      return;
    }

    setUploadingImage(true);
    setMessage('Uploading image...');
    try {
      const res = await apiClient.uploadImageToCloudinary(file);
      if (res && res.success && res.url) {
        setUploadedImageUrl(res.url);
        setGeneratedImage(res.url); // for preview reuse
        setMessage('Image uploaded successfully!');
      } else {
        throw new Error(res?.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Image upload error:', err);
      setMessage(`Image upload failed: ${err.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

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

  if (authLoading) {
    return (
      <div className="instagram-container">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="instagram-container">
        <div className="header-section">
          <button onClick={() => navigate('/')} className="back-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Dashboard
          </button>
          <h1>Instagram Management</h1>
          <p>Please log in to your account to connect and manage Instagram.</p>
        </div>
        <div className="auth-required">
          <div className="auth-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <circle cx="12" cy="16" r="1"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2>Authentication Required</h2>
          <p>You need to be logged in to use Instagram features. Please log in first.</p>
        </div>
      </div>
    );
  }

  if (!sdkLoaded) {
    return (
      <div className="instagram-container">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading Instagram SDK...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="instagram-container">
      <div className="header-section">
        <button onClick={() => navigate('/')} className="back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Dashboard
        </button>
        <div className="header-content">
          <div className="header-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
              <circle cx="12" cy="12" r="4"/>
              <path d="M17.5 6.5h.01"/>
            </svg>
          </div>
          <div className="header-text">
            <h1>Instagram Management</h1>
            <p>Connect and manage your Instagram Business accounts</p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`status-message ${message.includes('Error') || message.includes('Failed') ? 'error' : message.includes('success') ? 'success' : 'info'}`}>
          <div className="message-content">
            <span className="message-text">{message}</span>
          </div>
        </div>
      )}

      <div className="main-content">
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'connect' ? 'active' : ''}`}
            onClick={() => setActiveTab('connect')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h4v4M16 4l4 4M8 20H4v-4M8 20l-4-4"/>
            </svg>
            Connect Account
          </button>

          <button 
            className={`tab-button ${activeTab === 'post' ? 'active' : ''}`}
            onClick={() => setActiveTab('post')}
            disabled={!isConnected}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h18v18H3zM9 9h6v6H9z"/>
            </svg>
            Create Post
          </button>

          <button 
            className={`tab-button ${activeTab === 'media' ? 'active' : ''}`}
            onClick={() => setActiveTab('media')}
            disabled={!isConnected || !selectedAccount}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
            Media Gallery
          </button>

          <button
            className={`tab-button ${activeTab === 'automation' ? 'active' : ''}`}
            onClick={() => setActiveTab('automation')}
            disabled={!isConnected || !selectedAccount}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <path d="M8 12h8M12 8v8"/>
            </svg>
            Comment Automation
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'connect' && (
            <div className="connect-section">
              {!isConnected ? (
                <div className="connection-card">
                  <div className="connection-icon">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
                      <circle cx="12" cy="12" r="4"/>
                      <path d="M17.5 6.5h.01"/>
                    </svg>
                  </div>
                  <h2>Connect Instagram Account</h2>
                  <p>Connect your Instagram Business account through Facebook to start posting and managing content.</p>
                  
                  <button 
                    onClick={handleFacebookLogin} 
                    disabled={loading}
                    className="connect-main-button"
                  >
                    {loading ? (
                      <>
                        <div className="button-spinner"></div>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        Connect via Facebook
                      </>
                    )}
                  </button>

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
                    <button onClick={handleLogout} className="logout-button">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16,17 21,12 16,7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Disconnect
                    </button>
                  </div>
                  
                  <div className="accounts-grid">
                    {instagramAccounts.map(account => (
                      <div 
                        key={account.id} 
                        className={`account-card ${selectedAccount === account.id ? 'selected' : ''}`}
                        onClick={() => handleAccountChange(account.id)}
                      >
                        <div className="account-avatar">
                          {account.profile_picture_url ? (
                            <img src={account.profile_picture_url} alt={account.username} />
                          ) : (
                            <div className="avatar-placeholder">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="account-info">
                          <h3>@{account.username}</h3>
                          <p>{account.name}</p>
                          <div className="account-stats">
                            <span>{account.followers_count} followers</span>
                            <span>{account.media_count} posts</span>
                          </div>
                        </div>
                        {selectedAccount === account.id && (
                          <div className="selected-indicator">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20,6 9,17 4,12"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'post' && selectedAccount && (
            <div className="post-section">
              {/* Post Type Toggle UI */}
              <div className="post-type-toggle image-source-toggle" style={{ marginBottom: '24px' }}>
                <button
                  type="button"
                  className={`toggle-btn${selectedPostType === 'photo' ? ' active' : ''}`}
                  onClick={() => setSelectedPostType('photo')}
                >
                  <span role="img" aria-label="Photo">📷</span> Photo Post
                </button>
                <button
                  type="button"
                  className={`toggle-btn${selectedPostType === 'carousel' ? ' active' : ''}`}
                  onClick={() => setSelectedPostType('carousel')}
                >
                  <span role="img" aria-label="Carousel">🖼️</span> Carousel Post
                </button>
                <button
                  type="button"
                  className={`toggle-btn${selectedPostType === 'reel' ? ' active' : ''}`}
                  onClick={() => setSelectedPostType('reel')}
                >
                  <span role="img" aria-label="Reel">🎬</span> Reel Post
                </button>
              </div>

              {/* Carousel Post Section */}
              {selectedPostType === 'carousel' && (
                <div className="carousel-post-section">
                  {/* Mode Toggle */}
                  <div className="form-group">
                    <div className="post-header">
                              <h2>Carousel Mode</h2>
                              <p>Choose the mode for your carousel post</p>
                            </div>
                    <div className="image-source-toggle">
                      <button
                        type="button"
                        className={`toggle-btn ${carouselMode === 'ai' ? 'active' : ''}`}
                        onClick={() => setCarouselMode('ai')}
                        disabled={isGeneratingCarousel || isUploadingCarousel}
                      >
                        
                        <span role="img" aria-label="AI">🤖</span> Create with AI
                      </button>
                      <button
                        type="button"
                        className={`toggle-btn ${carouselMode === 'upload' ? 'active' : ''}`}
                        onClick={() => setCarouselMode('upload')}
                        disabled={isGeneratingCarousel || isUploadingCarousel}
                      >
                        <span role="img" aria-label="Upload">📤</span> Upload Images
                      </button>
                    </div>
                  </div>


                  {/* Image Count Selector */}
                  <div className="form-group">
                    <div className="post-label">
                              <h4>Number of Images</h4>
                              <p>Choose the number of images for your carousel post</p>
                            </div>
                    <input
                      type="range"
                      min="3"
                      max="7"
                      value={carouselImageCount}
                      onChange={(e) => setCarouselImageCount(parseInt(e.target.value))}
                      className="slider"
                      disabled={isGeneratingCarousel || isUploadingCarousel}
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
                  {carouselMode === 'ai' && (
                    <div className="ai-carousel-section">
                      <div className="form-group">
                        <label>AI Prompt</label>
                        <textarea
                          value={carouselPrompt}
                          onChange={(e) => setCarouselPrompt(e.target.value)}
                          placeholder="Describe the carousel content you want to generate..."
                          rows="3"
                          className="post-textarea"
                          disabled={isGeneratingCarousel}
                        />
                      </div>

                      <button
                        className="generate-button"
                        onClick={handleGenerateAICarousel}
                        disabled={!carouselPrompt.trim() || isGeneratingCarousel}
                      >
                        {isGeneratingCarousel ? (
                          <>
                            <div className="button-spinner"></div>
                            Generating...
                          </>
                        ) : (
                          <>
                            <span role="img" aria-label="Generate">✨</span> Generate Carousel
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Upload Mode */}
                  {carouselMode === 'upload' && (
                    <div className="upload-carousel-section">
                      <div className="form-group">
                        <label>Upload Images (JPG/PNG)</label>
                        <div className="file-upload-container">
                          <input
                            type="file"
                            id="carousel-upload"
                            accept="image/jpeg, image/png"
                            multiple
                            onChange={(e) => handleCarouselImageUpload(e.target.files)}
                            disabled={isUploadingCarousel}
                            style={{ display: 'none' }}
                          />
                          <label htmlFor="carousel-upload" className="file-upload-button">
                            {isUploadingCarousel ? (
                              <>
                                <div className="button-spinner"></div>
                                Uploading...
                              </>
                            ) : (
                              <>
                                <span role="img" aria-label="Upload">📤</span> Select {carouselImageCount} Images
                              </>
                            )}
                          </label>
                          <p className="file-upload-hint">
                            Select {carouselImageCount} images for your carousel
                          </p>
                        </div>
                      </div>
                      <div className="form-group">
                        <label htmlFor="carousel-caption-prompt">Enter Text Prompt for Caption</label>
                        <div className="prompt-wrapper">
                          <textarea
                            id="carousel-caption-prompt"
                            value={carouselPrompt}
                            onChange={e => setCarouselPrompt(e.target.value)}
                            placeholder="Write a prompt for your caption (optional)..."
                            rows="3"
                            className="post-textarea"
                          />
                          <button
                            className="ai-generate-button"
                            onClick={async () => {
                              if (!carouselPrompt.trim()) {
                                setMessage('Please enter a prompt for caption.');
                                return;
                              }
                              setGeneratingContent(true);
                              setMessage('Generating caption with AI...');
                              try {
                                const response = await apiClient.request('/api/ai/generate-content', {
                                  method: 'POST',
                                  body: JSON.stringify({
                                    prompt: carouselPrompt.trim(),
                                    platform: 'instagram',
                                    content_type: 'post',
                                    max_length: 2200,
                                    generate_image: false
                                  })
                                });
                                if (response && response.content) {
                                  setCarouselCaption(response.content);
                                  setMessage('Caption generated!');
                                } else {
                                  setMessage('Failed to generate caption.');
                                }
                              } catch (err) {
                                setMessage('Error: ' + (err.message || err.toString()));
                              } finally {
                                setGeneratingContent(false);
                              }
                            }}
                            disabled={generatingContent || !carouselPrompt.trim()}
                          >
                            {generatingContent ? (
                              <><div className="button-spinner"></div> Generating...</>
                            ) : (
                              <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M12 6v6l4 2"/></svg> Generate Caption with AI</>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>AI Caption</label>
                        <textarea
                          value={carouselCaption}
                          onChange={e => setCarouselCaption(e.target.value)}
                          placeholder="Your AI-generated or custom caption will appear here..."
                          rows="3"
                          className="post-textarea"
                        />
                      </div>
                    </div>
                  )}

                  {/* Preview Section */}
                  {(carouselImages.length > 0 || uploadedCarouselImages.length > 0) && (
                    <div className="carousel-preview-section">
                      <h4>Carousel Preview</h4>
                      <div className="carousel-preview-grid">
                        {(carouselMode === 'ai' ? carouselImages : uploadedCarouselImages)
                          .slice(0, carouselImageCount)
                          .map((url, index) => (
                            <div key={index} className="carousel-preview-item">
                              <img src={url} alt={`Carousel item ${index + 1}`} />
                              <span className="carousel-item-number">{index + 1}</span>
                            </div>
                          ))}
                      </div>

                      {carouselCaption && (
                        <div className="form-group" style={{ marginTop: '16px' }}>
                          <label>Caption</label>
                          <textarea
                            value={carouselCaption}
                            onChange={(e) => setCarouselCaption(e.target.value)}
                            rows="3"
                            className="post-textarea"
                          />
                        </div>
                      )}

                      <button
                        className="publish-button"
                        onClick={handlePublishCarousel}
                        disabled={
                          isPublishingCarousel ||
                          (carouselMode === 'ai' ? carouselImages.length === 0 : uploadedCarouselImages.length === 0) ||
                          !carouselCaption.trim()
                        }
                      >
                        {isPublishingCarousel ? (
                          <>
                            <div className="button-spinner"></div>
                            Publishing...
                          </>
                        ) : (
                          <>
                            <span role="img" aria-label="Publish">📤</span> Publish Carousel
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
              {/* Reel Post Section */}
              {selectedPostType === 'reel' && (
                <div className="reel-post-section">
                  <div class="post-card">
                                    <div className="post-header">
                    <h2>Create Instagram Content</h2>
                    <p>Create engaging content for your Instagram audience</p>
                  </div>

                  {/* Mode Toggle */}
                  <div className="image-source-toggle" style={{ marginBottom: 24 }}>
                    <button
                      type="button"
                      className={`toggle-btn${reelMode === 'ai' ? ' active' : ''}`}
                      onClick={() => setReelMode('ai')}
                    >
                      <span role="img" aria-label="AI">🤖</span> Create Video with AI
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn${reelMode === 'upload' ? ' active' : ''}`}
                      onClick={() => setReelMode('upload')}
                    >
                      <span role="img" aria-label="Upload">📁</span> Upload Video from Device
                    </button>
                  </div>
                  {/* AI Mode */}
                  {reelMode === 'ai' && (
                    <>
                      <div className="form-group">
                        <label>AI Video Prompt</label>
                        <textarea
                          value={reelPrompt}
                          onChange={e => setReelPrompt(e.target.value)}
                          placeholder="Describe your Reel video (e.g., 'A relaxing beach wave with sunset')"
                          rows="3"
                          className="post-textarea"
                          disabled={generatingReel}
                        />
                      </div>
                      <button
                        className="generate-button"
                        onClick={handleGenerateAIReel}
                        disabled={generatingReel || !reelPrompt.trim()}
                        style={{ marginBottom: 16 }}
                      >
                        {generatingReel ? (
                          <><div className="button-spinner"></div> Generating Video...</>
                        ) : (
                          <><span role="img" aria-label="AI">🤖</span> Generate Video</>
                        )}
                      </button>
                      <div className="form-group">
                        <label htmlFor="reel-caption-prompt">Enter Text Prompt for Caption</label>
                        <div className="prompt-wrapper">
                          <textarea
                            id="reel-caption-prompt"
                            value={reelCaptionPrompt || reelPrompt}
                            onChange={e => setReelCaptionPrompt(e.target.value)}
                            placeholder="Write a prompt for your caption (optional)..."
                            rows="3"
                            className="post-textarea"
                          />
                          <button
                            className="ai-generate-button"
                            onClick={async () => {
                              const promptToUse = reelCaptionPrompt?.trim() || reelPrompt.trim();
                              if (!promptToUse) {
                                setMessage('Please enter a prompt for caption.');
                                return;
                              }
                              setGeneratingReelCaption(true);
                              setMessage('Generating caption with AI...');
                              try {
                                const response = await apiClient.request('/api/ai/generate-content', {
                                  method: 'POST',
                                  body: JSON.stringify({
                                    prompt: promptToUse,
                                    platform: 'instagram',
                                    content_type: 'post',
                                    max_length: 2200,
                                    generate_image: false
                                  })
                                });
                                if (response && response.content) {
                                  setReelCaption(response.content);
                                  setMessage('Caption generated!');
                                } else {
                                  setMessage('Failed to generate caption.');
                                }
                              } catch (err) {
                                setMessage('Error: ' + (err.message || err.toString()));
                              } finally {
                                setGeneratingReelCaption(false);
                              }
                            }}
                            disabled={generatingReelCaption || !(reelCaptionPrompt?.trim() || reelPrompt.trim())}
                            title="Generate caption with AI"
                          >
                            {generatingReelCaption ? (
                              <><div className="button-spinner"></div> Generating...</>
                            ) : (
                              <><span role="img" aria-label="AI">🤖</span> Generate Caption with AI</>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>AI Caption</label>
                        <textarea
                          value={reelCaption}
                          onChange={e => setReelCaption(e.target.value)}
                          placeholder="Your AI-generated or custom caption will appear here..."
                          rows="3"
                          className="post-textarea"
                        />
                      </div>
                      {reelVideoUrl && (
                        <div className="reel-preview-section">
                          <h4>Reel Preview</h4>
                          <video controls style={{ width: '100%', maxHeight: 400, borderRadius: 8 }}>
                            <source src={reelVideoUrl} type="video/mp4" />
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      )}
                      <button
                        className="publish-button"
                        onClick={handlePublishReel}
                        disabled={publishingReel || !reelVideoUrl || !reelCaption.trim()}
                        style={{ marginTop: 16 }}
                      >
                        {publishingReel ? (
                          <><div className="button-spinner"></div> Publishing...</>
                        ) : (
                          <><span role="img" aria-label="Publish">📤</span> Publish Reel</>
                        )}
                      </button>
                    </>
                  )}
                  {/* Upload Mode */}
                  {reelMode === 'upload' && (
                    <div className="reel-upload-section">
                      <div className="form-group">
                        <label>Upload Reel Video (.mp4, max 90s, 9:16)</label>
                        <input
                          type="file"
                          id="reel-upload"
                          accept="video/mp4"
                          onChange={handleReelVideoUpload}
                          disabled={uploadingReel}
                          style={{ display: 'none' }}
                        />
                        <label htmlFor="reel-upload" className="file-upload-button">
                          {uploadingReel ? (
                            <>
                              <div className="button-spinner"></div>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <span role="img" aria-label="Upload">📤</span> Choose Video
                            </>
                          )}
                        </label>
                        {uploadedReelFile && <div style={{ marginTop: 8 }}>{uploadedReelFile.name}</div>}
                      </div>
                      <div className="form-group">
                        <label htmlFor="reel-caption-prompt-upload">Enter Text Prompt for Caption (Optional)</label>
                        <div className="prompt-wrapper">
                          <textarea
                            id="reel-caption-prompt-upload"
                            value={reelCaptionPrompt}
                            onChange={e => setReelCaptionPrompt(e.target.value)}
                            placeholder="Write a prompt for your caption (optional)..."
                            rows="3"
                            className="post-textarea"
                          />
                          <button
                            className="ai-generate-button"
                            onClick={async () => {
                              if (!reelCaptionPrompt.trim()) {
                                setMessage('Please enter a prompt for caption.');
                                return;
                              }
                              setGeneratingReelCaption(true);
                              setMessage('Generating caption with AI...');
                              try {
                                const response = await apiClient.request('/api/ai/generate-content', {
                                  method: 'POST',
                                  body: JSON.stringify({
                                    prompt: reelCaptionPrompt.trim(),
                                    platform: 'instagram',
                                    content_type: 'post',
                                    max_length: 2200,
                                    generate_image: false
                                  })
                                });
                                if (response && response.content) {
                                  setReelCaption(response.content);
                                  setMessage('Caption generated!');
                                } else {
                                  setMessage('Failed to generate caption.');
                                }
                              } catch (err) {
                                setMessage('Error: ' + (err.message || err.toString()));
                              } finally {
                                setGeneratingReelCaption(false);
                              }
                            }}
                            disabled={generatingReelCaption || !reelCaptionPrompt.trim()}
                            title="Generate caption with AI"
                          >
                            {generatingReelCaption ? (
                              <><div className="button-spinner"></div> Generating...</>
                            ) : (
                              <><span role="img" aria-label="AI">🤖</span> Generate Caption with AI</>
                            )}
                          </button>
                        </div>
                      </div>
                      {uploadedReelUrl && (
                        <div className="reel-preview-section">
                          <h4>Reel Preview</h4>
                          <video controls style={{ width: '100%', maxHeight: 400, borderRadius: 8 }}>
                            <source src={uploadedReelUrl} type="video/mp4" />
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      )}
                      <div className="form-group">
                        <label>AI Caption</label>
                        <textarea
                          value={reelCaption}
                          onChange={e => setReelCaption(e.target.value)}
                          placeholder="Your AI-generated or custom caption will appear here..."
                          rows="3"
                          className="post-textarea"
                        />
                      </div>
                      <button
                        className="publish-button"
                        onClick={handlePublishUploadedReel}
                        disabled={publishingReel || !uploadedReelUrl || !reelCaption.trim()}
                        style={{ marginTop: 16 }}
                      >
                        {publishingReel ? (
                          <><div className="button-spinner"></div> Publishing...</>
                        ) : (
                          <><span role="img" aria-label="Publish">📤</span> Publish Reel</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                </div>
              )}
              {/* Only render Photo Post UI if selectedPostType === 'photo' */}
              {selectedPostType === 'photo' && (
                <div className="post-card">
                  <div className="post-header">
                    <h2>Create Instagram Content</h2>
                    <p>Create engaging content for your Instagram audience</p>
                  </div>

                  <div className="post-form">
                    <div className="form-group">
                      <label>Image Source</label>
                      <div className="image-source-toggle">
                        <button
                          type="button"
                          className={`toggle-btn ${imageSource === 'ai' ? 'active' : ''}`}
                          onClick={() => setImageSource('ai')}
                        >
                          Create Image with AI
                        </button>
                        <button
                          type="button"
                          className={`toggle-btn ${imageSource === 'upload' ? 'active' : ''}`}
                          onClick={() => setImageSource('upload')}
                        >
                          Upload Image from Device
                        </button>
                      </div>
                    </div>

                    {/* Prompt & caption generation available regardless of image source */}
                    <div className="form-group">
                      <label htmlFor="prompt">Enter Text Prompt</label>
                      <div className="prompt-wrapper">
                        <textarea
                          id="prompt"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="Describe what you want to post..."
                          rows="4"
                          className="post-textarea"
                        />
                        <button 
                          className="ai-generate-button"
                          onClick={handleGenerateAIContent}
                          disabled={generatingContent || !prompt.trim()}
                        >
                          {generatingContent ? (
                            <>
                              <div className="button-spinner"></div>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                                <path d="M12 6v6l4 2"/>
                              </svg>
                              Generate Caption with AI
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {imageSource === 'upload' && (
                      <div className="form-group image-upload">
                        <label htmlFor="file-upload">Select Image</label>
                        <input
                          id="file-upload"
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={handleImageChange}
                          className="file-input"
                        />
                        <label htmlFor="file-upload" className="file-label">
                          {uploadingImage ? (
                            <>
                              <div className="button-spinner"></div> Uploading...
                            </>
                          ) : (
                            'Choose Image'
                          )}
                        </label>
                      </div>
                    )}

                    {selectedPostType === 'carousel' && (
                      <div className="carousel-post-section">
                        {/* Carousel Mode Toggle */}
                        <div className="image-source-toggle" style={{ marginBottom: '20px' }}>
                          <button
                            type="button"
                            className={`toggle-btn${imageSource === 'ai' ? ' active' : ''}`}
                            onClick={() => {
                              setImageSource('ai');
                              setCarouselAIImages([]);
                              setCarouselImages([]);
                              setMessage('');
                            }}
                          >

                            <span role="img" aria-label="AI">🤖</span> Create Images with AI
                          </button>
                          <button
                            type="button"
                            className={`toggle-btn${imageSource === 'upload' ? ' active' : ''}`}
                            onClick={() => {
                              setImageSource('upload');
                              setCarouselAIImages([]);
                              setCarouselImages([]);
                              setMessage('');
                            }}
                          >
                            <span role="img" aria-label="Upload">📂</span> Upload Images from Device
                          </button>
                        </div>

                        {/* AI Mode */}
                        {imageSource === 'ai' && (
                          <>
                            <div className="form-group">
                              <label htmlFor="carousel-ai-prompt">Text Prompt for Images</label>
                              <textarea
                                id="carousel-ai-prompt"
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                placeholder="Describe what you want to see in your carousel images..."
                                rows="3"
                                className="post-textarea"
                              />
                            </div>
                      <div className="form-group">
                        <label>Number of Images</label>
                              <select
                                value={carouselCount}
                                onChange={e => setCarouselCount(Number(e.target.value))}
                                className="post-type-dropdown"
                                style={{ maxWidth: 120 }}
                              >
                                {[3,4,5,6,7].map(num => (
                                  <option key={num} value={num}>{num}</option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                            <button
                                className="toggle-btn"
                                style={{ width: '100%', marginTop: 8, marginBottom: 16 }}
                                onClick={async () => {
                                  if (!prompt.trim()) {
                                    setMessage('Please enter a prompt.');
                                    return;
                                  }
                                  setCarouselAIGenerating(true);
                                  setMessage('Generating caption and images with AI...');
                                  try {
                                    // 1. Generate caption with Groq
                                    const captionRes = await apiClient.createAIPost({ prompt: prompt.trim() }, false);
                                    const aiCaption = captionRes.content || captionRes.generated_caption || '';
                                    setPostContent(aiCaption);
                                    // 2. Generate images with Stability AI (via backend)
                                    const imagesRes = await apiClient.generateCarouselImages({
                                      prompt: aiCaption,
                                      count: carouselCount
                                    });
                                    if (imagesRes.success && Array.isArray(imagesRes.urls)) {
                                      setCarouselAIImages(imagesRes.urls);
                                      setMessage('AI images generated and uploaded!');
                                    } else {
                                      setMessage('Failed to generate images.');
                                    }
                                  } catch (err) {
                                    setMessage('Error generating images: ' + (err.message || err.toString()));
                                  } finally {
                                    setCarouselAIGenerating(false);
                                  }
                                }}
                                disabled={carouselAIGenerating || !prompt.trim()}
                              >
                                {carouselAIGenerating ? (
                                  <><div className="button-spinner"></div> Generating...</>
                                ) : (
                                  <><span role="img" aria-label="AI">🤖</span> Generate with AI</>
                                )}
                            </button>
                            </div>
                            {/* Preview Section */}
                            {carouselAIImages.length > 0 && (
                              <div className="ai-images-preview">
                                <h4>Preview Images</h4>
                                <div className="ai-images-grid">
                                  {carouselAIImages.map((url, idx) => (
                                    <div key={idx} className="ai-image-item">
                                      <img src={url} alt={`AI ${idx+1}`} className="ai-preview-image" />
                                      <span>Image {idx+1}</span>
                                    </div>
                          ))}
                        </div>
                              </div>
                            )}
                            <div className="form-group" style={{ marginTop: 16 }}>
                              <label>Caption</label>
                              <textarea
                                value={postContent}
                                onChange={e => setPostContent(e.target.value)}
                                placeholder="Edit your caption here..."
                                rows="4"
                                className="post-textarea"
                              />
                            </div>
                            <button
                              className="publish-button"
                              style={{ marginTop: 16 }}
                              disabled={loading || carouselAIImages.length !== carouselCount || !postContent.trim()}
                              onClick={async () => {
                                setLoading(true);
                                setMessage('Publishing carousel post...');
                                try {
                                  const response = await apiClient.createInstagramPost({
                                    instagram_user_id: selectedAccount,
                                    caption: postContent,
                                    post_type: 'carousel',
                                    media_urls: carouselAIImages
                                  });
                                  if (response.success) {
                                    setMessage('Carousel post published successfully!');
                                    setPostContent('');
                                    setCarouselAIImages([]);
                                    setPrompt('');
                                    loadUserMedia(selectedAccount);
                                  } else {
                                    setMessage('Failed to publish: ' + (response.error || 'Unknown error'));
                                  }
                                } catch (err) {
                                  setMessage('Error publishing: ' + (err.message || err.toString()));
                                } finally {
                                  setLoading(false);
                                }
                              }}
                            >
                              {loading ? <><div className="button-spinner"></div> Publishing...</> : <><span role="img" aria-label="Publish">📤</span> Publish Carousel</>}
                            </button>
                          </>
                        )}

                        {/* Upload Mode */}
                        {imageSource === 'upload' && (
                          <>
                            <div className="form-group">
                              <label>Number of Images</label>
                              <select
                                value={carouselCount}
                                onChange={e => {
                                  setCarouselCount(Number(e.target.value));
                                  setCarouselImages(Array(Number(e.target.value)).fill(null));
                                }}
                                className="post-type-dropdown"
                                style={{ maxWidth: 120 }}
                              >
                                {[3,4,5,6,7].map(num => (
                                  <option key={num} value={num}>{num}</option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Upload Images (JPG/PNG, 1080x1080 recommended)</label>
                          <div className="carousel-upload-grid">
                                {Array.from({ length: carouselCount }).map((_, idx) => (
                                  <div key={idx} className="carousel-upload-item">
                                <input
                                      id={`carousel-upload-${idx}`}
                                  type="file"
                                  accept="image/png, image/jpeg, image/jpg"
                                      className="file-input"
                                      onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        setUploadingImage(true);
                                        setMessage(`Uploading image ${idx+1}...`);
                                        try {
                                          const res = await apiClient.uploadImageToCloudinary(file, {
                                            resize: '1080x1080',
                                            format: 'jpg',
                                            optimize: 'q_auto,f_auto'
                                          });
                                          if (res && res.success && res.url) {
                                    const files = [...carouselImages];
                                            files[idx] = res.url;
                                    setCarouselImages(files);
                                            setMessage(`Image ${idx+1} uploaded!`);
                                          } else {
                                            throw new Error(res?.error || 'Upload failed');
                                          }
                                        } catch (err) {
                                          setMessage(`Image upload failed: ${err.message}`);
                                        } finally {
                                          setUploadingImage(false);
                                        }
                                      }}
                                    />
                                    <label htmlFor={`carousel-upload-${idx}`} className="file-label">
                                      {carouselImages[idx] ? (
                                        <img src={carouselImages[idx]} alt={`carousel-${idx}`} className="carousel-preview-image" />
                                  ) : (
                                    <div className="upload-placeholder">
                                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                        <polyline points="17 8 12 3 7 8"/>
                                        <line x1="12" y1="3" x2="12" y2="15"/>
                                      </svg>
                                          <span>Image {idx+1}</span>
                                    </div>
                                  )}
                                </label>
                              </div>
                            ))}
                          </div>
                            </div>
                            <div className="form-group">
                              <label htmlFor="carousel-caption-prompt">Optional Caption Prompt</label>
                              <div className="prompt-wrapper">
                                <textarea
                                  id="carousel-caption-prompt"
                                  value={prompt}
                                  onChange={e => setPrompt(e.target.value)}
                                  placeholder="Write a prompt for your caption (optional)..."
                                  rows="3"
                                  className="post-textarea"
                                />
                                <button
                                  className="ai-generate-button"
                                  onClick={async () => {
                                    if (!prompt.trim()) {
                                      setMessage('Please enter a prompt for caption.');
                                      return;
                                    }
                                    setGeneratingContent(true);
                                    setMessage('Generating caption with AI...');
                                    try {
                                      const response = await apiClient.createAIPost({ prompt: prompt.trim() }, false);
                                      if (response.success) {
                                        setPostContent(response.content || response.generated_caption || '');
                                        setMessage('Caption generated!');
                                      } else {
                                        setMessage('Failed to generate caption.');
                                      }
                                    } catch (err) {
                                      setMessage('Error: ' + (err.message || err.toString()));
                                    } finally {
                                      setGeneratingContent(false);
                                    }
                                  }}
                                  disabled={generatingContent || !prompt.trim()}
                                >
                                  {generatingContent ? (
                                    <><div className="button-spinner"></div> Generating...</>
                                  ) : (
                                    <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M12 6v6l4 2"/></svg> Generate Caption with AI</>
                                  )}
                                </button>
                              </div>
                            </div>
                            {/* Preview Section */}
                            {carouselImages.filter(Boolean).length > 0 && (
                              <div className="ai-images-preview">
                                <h4>Preview Images</h4>
                                <div className="ai-images-grid">
                                  {carouselImages.map((url, idx) => url && (
                                    <div key={idx} className="ai-image-item">
                                      <img src={url} alt={`Upload ${idx+1}`} className="ai-preview-image" />
                                      <span>Image {idx+1}</span>
                                    </div>
                                  ))}
                        </div>
                      </div>
                    )}
                            <div className="form-group" style={{ marginTop: 16 }}>
                              <label>Caption</label>
                              <textarea
                                value={postContent}
                                onChange={e => setPostContent(e.target.value)}
                                placeholder="Write or edit your caption here..."
                                rows="4"
                                className="post-textarea"
                              />
                            </div>
                            <button
                              className="publish-button"
                              style={{ marginTop: 16 }}
                              disabled={loading || carouselImages.filter(Boolean).length !== carouselCount || !postContent.trim()}
                              onClick={async () => {
                                setLoading(true);
                                setMessage('Publishing carousel post...');
                                try {
                                  const response = await apiClient.createInstagramPost({
                                    instagram_user_id: selectedAccount,
                                    caption: postContent,
                                    post_type: 'carousel',
                                    media_urls: carouselImages
                                  });
                                  if (response.success) {
                                    setMessage('Carousel post published successfully!');
                                    setPostContent('');
                                    setCarouselImages([]);
                                    setPrompt('');
                                    loadUserMedia(selectedAccount);
                                  } else {
                                    setMessage('Failed to publish: ' + (response.error || 'Unknown error'));
                                  }
                                } catch (err) {
                                  setMessage('Error publishing: ' + (err.message || err.toString()));
                                } finally {
                                  setLoading(false);
                                }
                              }}
                            >
                              {loading ? <><div className="button-spinner"></div> Publishing...</> : <><span role="img" aria-label="Publish">📤</span> Publish Carousel</>}
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {(postContent || generatedImage) && (
                      <>
                        <div className="form-group">
                          <label>Generated Caption</label>
                          <textarea
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                            placeholder="Generated caption will appear here..."
                            rows="6"
                            className="post-textarea"
                          />
                        </div>

                        <div className="form-group">
                          <label>AI Generated Image</label>
                          <div className="generated-image">
                            {generatedImage && (
                              <img src={generatedImage} alt="AI Generated" />
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    <button 
                      onClick={handleCreatePost}
                      disabled={loading || !postContent.trim() || !(imageSource==='ai' ? generatedImage : uploadedImageUrl)}
                      className="publish-button"
                    >
                      {loading ? (
                        <>
                          <div className="button-spinner"></div>
                          Publishing...
                        </>
                      ) : (
                        <>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                          </svg>
                          Publish Post
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'media' && selectedAccount && (
            <div className="media-section">
              <div className="media-header">
                <h2>Recent Posts</h2>
                <p>Your latest Instagram content</p>
              </div>
              
              {loadingMedia ? (
                <div className="loading-media">
                  <div className="loading-spinner"></div>
                  <p>Loading media...</p>
                </div>
              ) : userMedia.length > 0 ? (
                <div className="media-grid">
                  {userMedia.slice(0, 12).map((media) => (
                    <div key={media.id} className="media-item">
                      <div className="media-content">
                        {media.media_type === 'IMAGE' ? (
                          <img src={media.media_url} alt="Instagram post" />
                        ) : media.media_type === 'VIDEO' ? (
                          <video controls>
                            <source src={media.media_url} type="video/mp4" />
                          </video>
                        ) : null}
                      </div>
                      <div className="media-overlay">
                        <div className="media-info">
                          <p className="media-caption">
                            {media.caption ? media.caption.substring(0, 100) + '...' : 'No caption'}
                          </p>
                          <p className="media-date">
                            {new Date(media.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-media">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                  <h3>No Media Found</h3>
                  <p>No media found for this account. Start creating posts to see them here!</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'automation' && selectedAccount && (
            <div className="automation-section">
              <h2>Instagram Comment Automation</h2>
             
              <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginTop: 24 }}>
                <div style={{ flex: 1 }}>
                  <h4>1. Select Media</h4>
                 
                </div>
                <div style={{ flex: 2 }}>
                  <h4>2. Comments & Replies</h4>
                  
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstagramPage;