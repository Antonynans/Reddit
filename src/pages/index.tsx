import { Stack } from '@chakra-ui/react';
import type { DocumentData, QuerySnapshot } from 'firebase/firestore';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import type { NextPage } from 'next';
import { useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRecoilValue } from 'recoil';

import { communityState } from '@/atoms/communitiesAtom';
import type { Post, PostVote } from '@/atoms/postsAtom';
import CreatePostLink from '@/components/Community/CreatePostLink';
import PersonalHome from '@/components/Community/PersonalHome';
import Premium from '@/components/Community/Premium';
import Recommendations from '@/components/Community/Recommendations';
import PageContentLayout from '@/components/Layout/PageContent';
import PostLoader from '@/components/Post/Loader';
import PostItem from '@/components/Post/PostItem';
import { auth, firestore } from '@/Firebase/clientApp';
import usePosts from '@/hooks/usePosts';

const Home: NextPage = () => {
  const [user, loadingUser] = useAuthState(auth);
  const {
    postStateValue,
    setPostStateValue,
    onVote,
    onSelectPost,
    onDeletePost,
    loading,
    setLoading,
  } = usePosts();
  const communityStateValue = useRecoilValue(communityState);

  const getUserHomePosts = async () => {
    setLoading(true);
    try {
      const feedPosts: Post[] = [];

      if (communityStateValue.mySnippets.length) {
        const myCommunityIds = communityStateValue.mySnippets.map(
          (snippet) => snippet.communityId
        );
        const postPromises: Array<Promise<QuerySnapshot<DocumentData>>> = [];
        [0, 1, 2].forEach((index) => {
          if (!myCommunityIds[index]) return;

          postPromises.push(
            getDocs(
              query(
                collection(firestore, 'posts'),
                where('communityId', '==', myCommunityIds[index]),
                limit(3)
              )
            )
          );
        });
        const queryResults = await Promise.all(postPromises);

        queryResults.forEach((result) => {
          const posts = result.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Post[];
          feedPosts.push(...posts);
        });
      } else {
        console.log('USER HAS NO COMMUNITIES - GETTING GENERAL POSTS');

        const postQuery = query(
          collection(firestore, 'posts'),
          orderBy('voteStatus', 'desc'),
          limit(10)
        );
        const postDocs = await getDocs(postQuery);
        const posts = postDocs.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Post[];
        feedPosts.push(...posts);
      }

      console.log('HERE ARE FEED POSTS', feedPosts);

      setPostStateValue((prev) => ({
        ...prev,
        posts: feedPosts,
      }));
    } catch (error: any) {
      console.log('getUserHomePosts error', error.message);
    }
    setLoading(false);
  };

  const getNoUserHomePosts = async () => {
    console.log('GETTING NO USER FEED');
    setLoading(true);
    try {
      const postQuery = query(
        collection(firestore, 'posts'),
        orderBy('voteStatus', 'desc'),
        limit(10)
      );
      const postDocs = await getDocs(postQuery);
      const posts = postDocs.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log('NO USER FEED', posts);

      setPostStateValue((prev) => ({
        ...prev,
        posts: posts as Post[],
      }));
    } catch (error: any) {
      console.log('getNoUserHomePosts error', error.message);
    }
    setLoading(false);
  };

  const getUserPostVotes = async () => {
    const postIds = postStateValue.posts.map((post) => post.id);
    const postVotesQuery = query(
      collection(firestore, `users/${user?.uid}/postVotes`),
      where('postId', 'in', postIds)
    );
    const unsubscribe = onSnapshot(postVotesQuery, (querySnapshot) => {
      const postVotes = querySnapshot.docs.map((postVote) => ({
        id: postVote.id,
        ...postVote.data(),
      }));

      setPostStateValue((prev) => ({
        ...prev,
        postVotes: postVotes as PostVote[],
      }));
    });

    return () => unsubscribe();
  };

  useEffect(() => {
    if (!communityStateValue.initSnippetsFetched) return;

    if (user) {
      getUserHomePosts();
    }
  }, [user, communityStateValue.initSnippetsFetched]);

  useEffect(() => {
    if (!user && !loadingUser) {
      getNoUserHomePosts();
    }
  }, [user, loadingUser]);

  useEffect(() => {
    if (!user?.uid || !postStateValue.posts.length) return;
    getUserPostVotes();

    return () => {
      setPostStateValue((prev) => ({
        ...prev,
        postVotes: [],
      }));
    };
  }, [postStateValue.posts, user?.uid]);

  return (
    <PageContentLayout>
      <>
        <CreatePostLink />
        {loading ? (
          <PostLoader />
        ) : (
          <Stack>
            {postStateValue.posts.map((post: Post, index) => (
              <PostItem
                key={post.id}
                post={post}
                postIdx={index}
                onVote={onVote}
                onDeletePost={onDeletePost}
                userVoteValue={
                  postStateValue.postVotes.find(
                    (item) => item.postId === post.id
                  )?.voteValue
                }
                userIsCreator={user?.uid === post.creatorId}
                onSelectPost={onSelectPost}
                homePage
              />
            ))}
          </Stack>
        )}
      </>
      <Stack spacing={5} position="sticky" top="14px">
        <Recommendations />
        <Premium />
        <PersonalHome />
      </Stack>
    </PageContentLayout>
  );
};

export default Home;
