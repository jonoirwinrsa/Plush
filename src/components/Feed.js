import React from 'react'
import {
  Alert,
  Keyboard,
  StyleSheet,
  TextInput,
  Modal,
  TouchableOpacity,
  View,
  ScrollView,
  RefreshControl
} from 'react-native'

import API, { graphqlOperation } from '@aws-amplify/api'
import Auth from '@aws-amplify/auth'
import Amplify from '@aws-amplify/core'
import Storage from '@aws-amplify/storage'

import { RNS3 } from 'react-native-aws3'; // for sending pics to S3

import { Card, Text } from 'native-base'
import { Ionicons } from '@expo/vector-icons'
import { ImagePicker, Permissions } from 'expo'


import { v4 as uuid } from 'uuid';

import config from '../aws-exports'
import keys from '../keys'

import CreatePost from '../graphQL/CreatePost'
import CreatePicture from '../graphQL/CreatePicture'
// import DeletePicture from '../graphQL/DeletePicture'
import CreateLike from '../graphQL/CreateLike'
import DeletePost from '../graphQL/DeletePost'
import listPosts from '../graphQL/listPosts'

// Apollo components
import { graphql, compose } from 'react-apollo'

Amplify.configure(config)

class Feed extends React.Component {
  state = {
    modalVisible: false,
    posts: [],
    postOwnerId: '',
    likeOwnerId: '',
    postContent: '',
    postOwnerUsername: '',
    likeOwnerUsername: '',
    image: null,
    allImages: []
  }


  componentDidMount = async () => {
    await Auth.currentAuthenticatedUser()
      .then(user => {
        this.setState(
          {
            postOwnerUsername: user.username,
            likeOwnerUsername: user.username,
            postOwnerId: user.attributes.sub,
            likeOwnerId: user.attributes.sub,
          }
        )
      })
      .catch(err => console.log(err))
    await this.listPosts()
    // console.log(this.state.posts)
  }

  _onRefresh = () => {
    this.setState({ refreshing: true })
    this.componentDidMount()
      .then(() => {
        this.setState({ refreshing: false })
      })
  }

  showModal = () => {
    this.setState({ modalVisible: true })
  }

  hideModal = () => {
    this.setState({ modalVisible: false, postContent: '' })
  }

  onChangeText = (key, val) => {
    this.setState({ [key]: val })
  }

  listPosts = async () => {
    try {
      const graphqldata = await API.graphql(graphqlOperation(listPosts))
      const listOfAllposts = await graphqldata.data.listPosts.items
      this.setState({ posts: listOfAllposts })
    }
    catch (err) {
      console.log('error: ', err)
    }
  }

  createPost = async () => {
    const post = this.state
    if (post.postContent === '') {
      Alert.alert('Write something!')
      return
    }
    try {
      await API.graphql(graphqlOperation(CreatePost, post))
      await this.componentDidMount()
      Keyboard.dismiss()
      this.hideModal()
    } catch (err) {
      console.log('Error creating post.', err)
    }
  }

  // Working on it

  // createPicture = async () => {
  //   try {
  //     // await this.props.onAddPicture(
  //     //   {
  //     //     id: uuid(),
  //     //     postContent: this.state.postContent,
  //     //     postOwnerId: this.state.postOwnerId,
  //     //     postOwnerUsername: this.state.postOwnerUsername,
  //     //     file: {
  //     //       bucket: 'none',
  //     //       region: 'none',
  //     //       key: 'none',
  //     //       __typename: 'S3Object'
  //     //     },
  //     //     visibility: 'public'
  //     //   }
  //     // )
  //     await this.componentDidMount()
  //     Keyboard.dismiss()
  //     this.hideModal()
  //   } catch (err) {
  //     console.log('Error creating post.', err)
  //   }
  // }

  deletePostAlert = async (post) => {
    await Alert.alert(
      'Delete Post',
      'Are you sure you wanna delete this post?',
      [
        { text: 'Cancel', onPress: () => { return }, style: 'cancel' },
        { text: 'OK', onPress: () => this.deletePost(post) },
      ],
      { cancelable: false }
    )
  }

  deletePost = async (post) => {
    const postId = await post['id']
    try {
      await API.graphql(graphqlOperation(DeletePost, { id: postId }))
      await this.componentDidMount()
    } catch (err) {
      console.log('Error deleting post.', err)
    }
  }

  // Get pictures from device then upload them to AWS S3
  createPicture = async () => {
    await this.askPermissionsAsync()
    const { cancelled, uri } = await ImagePicker.launchImageLibraryAsync(
      {
        allowsEditing: false,
      }
    )
    if (!cancelled) {
      this.setState({ image: uri })
      this.sendPicS3(this.state.image)
    }
  }

  // Give Expo access to device library
  askPermissionsAsync = async () => {
    await Permissions.askAsync(Permissions.CAMERA_ROLL)
  }

  // Upload an image to S3
  sendPicS3 = async (uri) => {
    const { bucket, region } = this.props.options
    let pic = {
      uri: uri,
      name: uuid(),
      type: "image/jpeg",
      bucket,
      region,
    }
    const config = {
      keyPrefix: "images/public/",
      bucket,
      region,
      accessKey: keys.accessKey,
      secretKey: keys.secretKey,
      successActionStatus: 201
    }
    RNS3.put(pic, config)
      .then(response => {
        if (response.status !== 201) {
          throw new Error("Failed to upload image to S3");
        } else {
          console.log('Following file has been uploaded to AWS S3:', response)
        }
      })
  }

  // Toggle like will come here

  createLike = async (post) => {
    const postId = await post['id']
    const like = {
      likeOwnerId: this.state.likeOwnerId,
      likeOwnerUsername: this.state.likeOwnerUsername,
      id: postId,
    }
    try {
      await API.graphql(graphqlOperation(CreateLike, like))
      await this.componentDidMount()
    } catch (err) {
      console.log('Error creating like.', err)
    }
  }

  // Delete like will come here


  render() {
    let loggedInUser = this.state.postOwnerId
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.headerStyle}>
          <Modal
            animationType="slide"
            transparent={false}
            onRequestClose={() => { return }}
            visible={this.state.modalVisible}>
            <View style={styles.modalContainer}>
              <View style={styles.postCardStyle}>
                <Card>
                  <TextInput
                    onChangeText={val => this.onChangeText('postContent', val)}
                    placeholder="Tell us your best..."
                    value={this.state.postContent}
                    multiline={true}
                    maxLength={150}
                    autoFocus={true} // check for performance issue when true
                    style={{ height: 150, fontSize: 20, padding: 13 }}
                  />
                  <View style={{ alignItems: 'flex-end', padding: 5 }}>
                    <Text style={{ color: '#fb7777', fontWeight: 'bold' }}>
                      {150 - this.state.postContent.length}
                    </Text>
                  </View>
                </Card>
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    onPress={this.hideModal}
                    style={[styles.twinButtonStyle, { backgroundColor: '#5017AE' }]}>
                    <Text style={styles.buttonText}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={this.createPost}
                    style={[styles.twinButtonStyle, { backgroundColor: '#f16f69' }]}>
                    <Text style={styles.buttonText}>
                      Submit
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          {/* Open modal to write a post */}
          <TouchableOpacity onPress={this.showModal}>
            <Ionicons style={styles.iconStyle} name="md-create" />
          </TouchableOpacity>
          {/* Access device library to add pictures */}
          <TouchableOpacity onPress={this.createPicture}>
            <Ionicons style={styles.iconStyle} name="ios-camera" />
          </TouchableOpacity>
          <TouchableOpacity onPress={this.componentDidMount}>
            <Ionicons style={styles.iconStyle} name="ios-refresh" />
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={this.state.refreshing}
              onRefresh={this._onRefresh}
            />
          }
        >
          <View style={{ flex: 1, alignItems: 'center' }}>
            {
              this.state.posts.map((post, index) => (
                <Card key={index} style={styles.cardStyle}>
                  <View style={styles.cardHeaderStyle}>
                    {post.postOwnerId === loggedInUser &&
                      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start' }}>
                        <TouchableOpacity
                          onPress={() => this.deletePostAlert(post)}>
                          <Ionicons
                            style={{ color: '#1f267e', padding: 5, fontSize: 30 }}
                            name="md-more"
                          />
                        </TouchableOpacity>
                      </View>
                    }
                  </View>
                  <TouchableOpacity>
                    <Text style={styles.postBody}>
                      {post.postContent}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.cardFooterStyle}>
                    <View style={{ flex: 1, justifyContent: 'flex-start', alignItems: 'flex-start' }}>
                      <Text style={styles.postUsername}>
                        {post.postOwnerUsername}
                      </Text>
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-end' }}>
                      <TouchableOpacity
                        onPress={() => this.createLike(post)}>
                        <Ionicons style={{ fontSize: 45, color: '#69FB' }} name="md-heart" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              ))
            }
          </View>
        </ScrollView>
      </View>
    )
  }
}

export default compose(
  graphql(CreatePicture, {
    props: (props) => ({
      onAddPicture: (post) => {
        props.mutate({
          variables: post,
          optimisticResponse: () => ({
            createPost: { ...post, __typename: 'Picture' }
          }),
        })
      }
    }),
  }),
  // graphql(DeletePicture, {
  //   props: (props) => ({
  //     onRemovePost: (picture) => {
  //       props.mutate({
  //         variables: picture,
  //         optimisticResponse: () => ({
  //           deletePost: { ...picture, __typename: 'Picture' }
  //         }),
  //       })
  //     }
  //   }),
  // }),
)(Feed)

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerStyle: {
    padding: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postUsername: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f267e'
  },
  postBody: {
    fontSize: 20,
    color: '#1f267e',
    padding: 12
  },
  iconStyle: {
    color: '#5017ae',
    fontSize: 38
  },
  cardStyle: {
    flex: 1,
    backgroundColor: '#d0d9ed',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooterStyle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderStyle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  buttonContainer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  twinButtonStyle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderRadius: 3,
    width: 130,
    height: 48,
    flexDirection: 'row'
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#fff",
  },
  postCardStyle: {
    marginTop: 45,
    padding: 20
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#eadee4'
  }
})
